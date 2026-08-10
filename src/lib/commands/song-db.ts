// /src/lib/commands/song-db.ts
import { invoke } from "@tauri-apps/api/core";
import type { SongCue } from "$lib/types/models";

export interface SongInput {
  id: string;
  title: string;
  artist: string;
  lines_per_slide: number;
  raw_lyrics: string;
}

export interface SongSearchResult {
  id: string;
  title: string;
  artist: string | null;
  lyrics_snippet: string | null;
}

export async function fetchAllSongs(): Promise<SongCue[]> {
  return await invoke<SongCue[]>("fetch_all_songs");
}

export async function insertSongAPI(data: SongInput): Promise<void> {
  await invoke("insert_song", { data });
}

export async function updateSongAPI(data: SongInput): Promise<void> {
  await invoke("update_song", { data });
}

export async function deleteSongAPI(id: string): Promise<void> {
  await invoke("delete_song", { id });
}

export async function searchSongsFtsAPI(
  queryString: string,
  limit: number = 20,
): Promise<SongSearchResult[]> {
  return await invoke<SongSearchResult[]>("search_songs_fts", {
    queryString,
    limit,
  });
}
