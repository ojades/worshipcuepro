// src/lib/state/playlists.svelte.ts
import { convertFileSrc } from "@tauri-apps/api/core";
import { presentation } from "./presentation.svelte";
import { shootState } from "./shoot.svelte";
import { media } from "./media.svelte"; // <-- Ensure media state is imported
import { parseLyrics } from "$lib/utils/lyrics";
import {
  fetchAllPlaylistsAPI,
  createPlaylistAPI,
  updatePlaylistAPI,
  deletePlaylistAPI,
  fetchPlaylistCuesAPI,
  fetchPlaylistMetaAPI,
  addCueToPlaylistAPI,
  updatePlaylistSortOrderAPI,
  removeCueFromPlaylistAPI,
  type PlaylistMeta,
} from "$lib/commands/playlist-db";

export class PlaylistsState {
  allPlaylists = $state<PlaylistMeta[]>([]);

  async loadAll() {
    try {
      this.allPlaylists = await fetchAllPlaylistsAPI();
    } catch (error) {
      console.error("Failed to load playlists:", error);
    }
  }

  async create(title: string) {
    const id = crypto.randomUUID();
    try {
      await createPlaylistAPI(id, title);
      await this.loadAll();
    } catch (error) {
      console.error("Failed to create playlist:", error);
    }
  }

  async update(id: string, newTitle: string) {
    try {
      await updatePlaylistAPI(id, newTitle);
      await this.loadAll();

      if (presentation.activePlaylist?.id === id) {
        presentation.activePlaylist.name = newTitle;
      }
    } catch (error) {
      console.error("Failed to update playlist:", error);
    }
  }

  async delete(id: string) {
    try {
      await deletePlaylistAPI(id);
      await this.loadAll();

      if (presentation.activePlaylist?.id === id) {
        presentation.activePlaylist = null;
      }
    } catch (error) {
      console.error("Failed to delete playlist:", error);
    }
  }

  // --- PLAYLIST ITEMS MANAGEMENT ---

  async loadPlaylist(playlistId: string) {
    try {
      const rawCues = await fetchPlaylistCuesAPI(playlistId);

      // Hydrate special cue types
      const cues = await Promise.all(
        rawCues.map(async (cue: any) => {
          if (cue.type === "media") {
            // Find the item in local media state for a guaranteed valid asset_url
            const m = media.allMedia.find((x) => x.id === cue.id);
            const resolvedPath = cue.filepath || cue.url || m?.filepath || "";

            cue.asset_url =
              m?.asset_url ||
              (resolvedPath ? convertFileSrc(resolvedPath) : "");
            cue.filepath = resolvedPath;
            cue.media_type = cue.media_type || cue.type || m?.type || "video";
          } else if (cue.type === "shoot") {
            const fullShoot = await shootState.getShoot(cue.id);
            cue.sections = fullShoot.sections;
          } else if (cue.type === "song") {
            cue.sections = parseLyrics(
              cue.raw_lyrics || "",
              cue.lines_per_slide || 0,
            );
          }
          return cue;
        }),
      );

      const playlistMeta = await fetchPlaylistMetaAPI(playlistId);

      if (playlistMeta) {
        presentation.activePlaylist = { ...playlistMeta, cues };
      }
    } catch (error) {
      console.error("Failed to load playlist cues:", error);
    }
  }

  async ensureActivePlaylist(): Promise<string> {
    if (presentation.activePlaylist) {
      return presentation.activePlaylist.id;
    }

    const id = crypto.randomUUID();
    const title = `Live Session - ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    try {
      await createPlaylistAPI(id, title);
      await this.loadAll();
      await this.loadPlaylist(id);
      return id;
    } catch (error) {
      console.error("Failed to auto-create Live Session:", error);
      throw error;
    }
  }

  async addCueToActive(
    cueId: string,
    cueType: "song" | "media" | "shoot" = "song",
  ) {
    const playlistId = await this.ensureActivePlaylist();
    await this.addCueToPlaylist(playlistId, cueId, cueType);
  }

  async addCueToPlaylist(
    playlistId: string,
    cueId: string,
    cueType: "song" | "media" | "shoot" = "song",
  ) {
    const playlistItemId = crypto.randomUUID();
    try {
      await addCueToPlaylistAPI(playlistId, cueId, cueType, playlistItemId);

      if (presentation.activePlaylist?.id === playlistId) {
        let newCue: any = {
          id: cueId,
          playlist_item_id: playlistItemId,
          type: cueType,
        };

        if (cueType === "media") {
          const m = media.allMedia.find((x) => x.id === cueId);
          if (m) {
            newCue = {
              ...newCue,
              title: m.filename,
              filepath: m.filepath,
              media_type: m.type,
              asset_url: m.asset_url || convertFileSrc(m.filepath),
            };
          }
        } else if (cueType === "song") {
          newCue.title = "Loading Song...";
        } else if (cueType === "shoot") {
          newCue.title = "Loading Shoot...";
        }

        presentation.activePlaylist.cues = [
          ...presentation.activePlaylist.cues,
          newCue,
        ];

        await this.loadPlaylist(playlistId);
      }

      await this.loadAll();
    } catch (error) {
      console.error("Failed to add cue to playlist:", error);
    }
  }

  async updateSortOrder(newCuesArray: any[]) {
    if (!presentation.activePlaylist) return;

    presentation.activePlaylist.cues = newCuesArray;

    try {
      const updates = newCuesArray.map((cue, index) => ({
        playlist_item_id: cue.playlist_item_id,
        sort_order: index,
      }));

      await updatePlaylistSortOrderAPI(updates);
    } catch (error) {
      console.error("Failed to save new playlist order:", error);
      await this.loadPlaylist(presentation.activePlaylist.id);
    }
  }

  async removeCueFromPlaylist(playlistItemId: string, playlistId: string) {
    try {
      await removeCueFromPlaylistAPI(playlistItemId);

      if (presentation.activePlaylist?.id === playlistId) {
        await this.loadPlaylist(playlistId);
      }

      await this.loadAll();
    } catch (error) {
      console.error("Failed to remove cue from playlist:", error);
    }
  }
}

export const playlists = new PlaylistsState();
