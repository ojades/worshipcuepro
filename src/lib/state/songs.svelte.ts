// /src/lib/state/songs.svelte.ts
import { systemState } from "$lib/state/system.svelte";
import type { SongCue } from "$lib/types/models";
import {
  fetchAllSongs,
  insertSongAPI,
  updateSongAPI,
  deleteSongAPI,
  type SongSearchResult,
  searchSongsFtsAPI,
} from "$lib/commands/song-db";

class SongsState {
  songs = $state<SongCue[]>([]);
  isSearching = $state(false);

  async load() {
    try {
      this.songs = await fetchAllSongs();
    } catch (e) {
      console.error("Failed to load songs:", e);
      systemState.addAlert({
        message: "Failed to load songs from database.",
        type: "error",
      });
    }
  }

  async search(query: string, limit: number = 20): Promise<SongSearchResult[]> {
    if (query.trim().length < 2) return [];

    this.isSearching = true;
    try {
      return await searchSongsFtsAPI(query, limit);
    } catch (err) {
      console.error("Song FTS search failed:", err);
      return [];
    } finally {
      this.isSearching = false;
    }
  }

  async importSong(data: {
    title: string;
    artist: string;
    raw_lyrics: string;
  }) {
    try {
      const id = crypto.randomUUID();

      await insertSongAPI({
        id,
        title: data.title,
        artist: data.artist,
        lines_per_slide: 0,
        raw_lyrics: data.raw_lyrics,
      });

      await this.load();
      systemState.addAlert({
        message: "Song imported successfully.",
        type: "success",
      });
      return id;
    } catch (e) {
      console.error("Failed to import song:", e);
      systemState.addAlert({
        message: "Failed to import song.",
        type: "error",
      });
      return null;
    }
  }

  async create() {
    try {
      const id = crypto.randomUUID();

      await insertSongAPI({
        id,
        title: "New Song",
        artist: "",
        lines_per_slide: 0,
        raw_lyrics: "Verse 1\n\nType your lyrics here...",
      });

      await this.load();
      systemState.addAlert({ message: "New song created.", type: "success" });
      return id;
    } catch (e) {
      systemState.addAlert({
        message: "Failed to create song.",
        type: "error",
      });
      return null;
    }
  }

  async update(id: string, data: any) {
    try {
      await updateSongAPI({
        id,
        title: data.title,
        artist: data.artist || "",
        lines_per_slide: data.lines_per_slide || 0,
        raw_lyrics: data.raw_lyrics || "",
      });

      await this.load();
      systemState.addAlert({
        message: "Song saved successfully.",
        type: "success",
      });
    } catch (e) {
      systemState.addAlert({ message: "Failed to save song.", type: "error" });
    }
  }

  async delete(id: string) {
    try {
      await deleteSongAPI(id);
      await this.load();
      systemState.addAlert({
        message: "Song deleted successfully.",
        type: "success",
      });
      return true;
    } catch (e) {
      console.error("Failed to delete song:", e);
      systemState.addAlert({
        message: "Failed to delete song.",
        type: "error",
      });
      return false;
    }
  }
}

export const songsState = new SongsState();
