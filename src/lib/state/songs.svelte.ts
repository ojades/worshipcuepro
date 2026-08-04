// src/lib/state/songs.svelte.ts
import { getDB } from "$lib/db";
import { systemState } from "$lib/state/system.svelte";
import type { SongCue } from "$lib/types/models";

class SongsState {
  songs = $state<SongCue[]>([]);

  async load() {
    try {
      const db = getDB();
      this.songs = await db.select("SELECT * FROM songs ORDER BY title ASC");
    } catch (e) {
      console.error("Failed to load songs:", e);
      systemState.addAlert({
        message: "Failed to load songs from database.",
        type: "error",
      });
    }
  }

  async create() {
    try {
      const db = getDB();
      const id = crypto.randomUUID();
      const defaultTitle = "New Song";
      const defaultArtist = "";
      const defaultLyrics = "Verse 1\n\nType your lyrics here...";

      await db.execute(
        "INSERT INTO songs (id, title, artist, lines_per_slide, raw_lyrics) VALUES ($1, $2, $3, $4, $5)",
        [id, defaultTitle, defaultArtist, 0, defaultLyrics],
      );

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
      const db = getDB();
      await db.execute(
        "UPDATE songs SET title = $1, artist = $2, lines_per_slide = $3, raw_lyrics = $4 WHERE id = $5",
        [data.title, data.artist, data.lines_per_slide, data.raw_lyrics, id],
      );
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
      const db = getDB();
      await db.execute("DELETE FROM songs WHERE id = $1", [id]);

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
