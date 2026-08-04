// src/lib/state/playlists.svelte.ts
import { getDB } from "$lib/db";
import { convertFileSrc } from "@tauri-apps/api/core";
import { presentation } from "./presentation.svelte";
import { shootState } from "./shoot.svelte";
import { parseLyrics } from "$lib/utils/lyrics";
import { settingsState } from "./settings.svelte";

export interface PlaylistMeta {
  id: string;
  name: string;
  created_at: string;
  cueCount: number;
}

export class PlaylistsState {
  allPlaylists = $state<PlaylistMeta[]>([]);

  // Fetch all playlists with their cue counts
  async loadAll() {
    const db = getDB();
    try {
      const result = await db.select<PlaylistMeta[]>(`
        SELECT
          p.id,
          p.name,
          p.created_at,
          COUNT(pi.id) as cueCount
        FROM playlists p
        LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `);
      this.allPlaylists = result;
    } catch (error) {
      console.error("Failed to load playlists:", error);
    }
  }

  async create(title: string) {
    const db = getDB();
    const id = crypto.randomUUID();
    try {
      await db.execute("INSERT INTO playlists (id, name) VALUES ($1, $2)", [
        id,
        title,
      ]);
      await this.loadAll();
    } catch (error) {
      console.error("Failed to create playlist:", error);
    }
  }

  async update(id: string, newTitle: string) {
    const db = getDB();
    try {
      await db.execute("UPDATE playlists SET name = $1 WHERE id = $2", [
        newTitle,
        id,
      ]);
      await this.loadAll();

      // If the active playlist was renamed, update it in presentation state too
      if (presentation.activePlaylist?.id === id) {
        presentation.activePlaylist.name = newTitle;
      }
    } catch (error) {
      console.error("Failed to update playlist:", error);
    }
  }

  async delete(id: string) {
    const db = getDB();
    try {
      // Delete items first, then the playlist sequentially
      await db.execute("DELETE FROM playlist_items WHERE playlist_id = $1", [
        id,
      ]);
      await db.execute("DELETE FROM playlists WHERE id = $1", [id]);

      await this.loadAll();

      // Clear active view if we just deleted it
      if (presentation.activePlaylist?.id === id) {
        presentation.activePlaylist = null;
      }
    } catch (error) {
      console.error("Failed to delete playlist:", error);
    }
  }

  // --- PLAYLIST ITEMS MANAGEMENT ---

  async loadPlaylist(playlistId: string) {
    const db = getDB();
    try {
      const rawCues = await db.select<any[]>(
        `SELECT
               pi.id as playlist_item_id,
               pi.sort_order,
               pi.item_id as id,
               pi.item_type as type,
               COALESCE(s.title, m.filename, sh.title) as title,
               s.raw_lyrics,
               m.filepath,
               m.type as media_type
             FROM playlist_items pi
             LEFT JOIN songs s ON pi.item_id = s.id AND pi.item_type = 'song'
             LEFT JOIN media m ON pi.item_id = m.id AND pi.item_type = 'media'
             LEFT JOIN shoots sh ON pi.item_id = sh.id AND pi.item_type = 'shoot' -- <-- Add Shoots Join
             WHERE pi.playlist_id = $1
             ORDER BY pi.sort_order ASC`,
        [playlistId],
      );

      // Hydrate special cue types
      const cues = await Promise.all(
        rawCues.map(async (cue) => {
          if (cue.type === "media" && cue.filepath) {
            cue.asset_url = convertFileSrc(cue.filepath);
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

      const playlistMeta = await db.select<PlaylistMeta[]>(
        "SELECT id, name, created_at FROM playlists WHERE id = $1",
        [playlistId],
      );

      if (playlistMeta.length > 0) {
        presentation.activePlaylist = { ...playlistMeta[0], cues };
      }
    } catch (error) {
      console.error("Failed to load playlist cues:", error);
    }
  }

  async ensureActivePlaylist(): Promise<string> {
    if (presentation.activePlaylist) {
      return presentation.activePlaylist.id;
    }

    // Auto-create a fallback "Live Session" if none exists
    const db = getDB();
    const id = crypto.randomUUID();
    const title = `Live Session - ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    try {
      await db.execute("INSERT INTO playlists (id, name) VALUES ($1, $2)", [
        id,
        title,
      ]);
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
    const db = getDB();
    const id = crypto.randomUUID();
    try {
      // Get the next sort_order based on current items
      const rows = await db.select<{ count: number }[]>(
        "SELECT COUNT(id) as count FROM playlist_items WHERE playlist_id = $1",
        [playlistId],
      );
      const sortOrder = rows[0].count;

      await db.execute(
        `INSERT INTO playlist_items (id, playlist_id, item_id, item_type, sort_order)
            VALUES ($1, $2, $3, $4, $5)`,
        [id, playlistId, cueId, cueType, sortOrder],
      );

      // If we just added to the currently active playlist, refresh it immediately
      if (presentation.activePlaylist?.id === playlistId) {
        await this.loadPlaylist(playlistId);
      }

      // Update the cue counts in the library tab
      await this.loadAll();
    } catch (error) {
      console.error("Failed to add cue to playlist:", error);
    }
  }

  async updateSortOrder(newCuesArray: any[]) {
    if (!presentation.activePlaylist) return;

    presentation.activePlaylist.cues = newCuesArray;
    const db = getDB();

    try {
      // Execute sequentially without spanning a manual transaction across async calls
      for (let i = 0; i < newCuesArray.length; i++) {
        await db.execute(
          "UPDATE playlist_items SET sort_order = $1 WHERE id = $2",
          [i, newCuesArray[i].playlist_item_id],
        );
      }
    } catch (error) {
      console.error("Failed to save new playlist order:", error);
      await this.loadPlaylist(presentation.activePlaylist.id); // Revert UI on fail
    }
  }

  async removeCueFromPlaylist(playlistItemId: string, playlistId: string) {
    const db = getDB();
    try {
      await db.execute("DELETE FROM playlist_items WHERE id = $1", [
        playlistItemId,
      ]);

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
