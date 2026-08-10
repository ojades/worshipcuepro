// /src/lib/commands/playlist-db.ts
import { invoke } from "@tauri-apps/api/core";

export interface PlaylistMeta {
  id: string;
  name: string;
  created_at: string;
  cueCount: number;
}

export interface PlaylistCueRow {
  playlist_item_id: string;
  sort_order: number;
  id: string;
  type: string;
  title: string | null;
  raw_lyrics: string | null;
  filepath: string | null;
  media_type: string | null;
}

export interface SortOrderItem {
  playlist_item_id: string;
  sort_order: number;
}

export async function fetchAllPlaylistsAPI(): Promise<PlaylistMeta[]> {
  return await invoke<PlaylistMeta[]>("fetch_all_playlists");
}

export async function createPlaylistAPI(
  id: string,
  title: string,
): Promise<void> {
  await invoke("create_playlist", { id, title });
}

export async function updatePlaylistAPI(
  id: string,
  newTitle: string,
): Promise<void> {
  await invoke("update_playlist", { id, newTitle });
}

export async function deletePlaylistAPI(id: string): Promise<void> {
  await invoke("delete_playlist", { id });
}

export async function fetchPlaylistCuesAPI(
  playlistId: string,
): Promise<PlaylistCueRow[]> {
  return await invoke<PlaylistCueRow[]>("fetch_playlist_cues", { playlistId });
}

export async function fetchPlaylistMetaAPI(
  playlistId: string,
): Promise<PlaylistMeta | null> {
  return await invoke<PlaylistMeta | null>("fetch_playlist_meta", {
    playlistId,
  });
}

export async function addCueToPlaylistAPI(
  playlistId: string,
  itemId: string,
  itemType: string,
  playlistItemId: string,
): Promise<void> {
  await invoke("add_cue_to_playlist", {
    playlistId,
    itemId,
    itemType,
    playlistItemId,
  });
}

export async function updatePlaylistSortOrderAPI(
  updates: SortOrderItem[],
): Promise<void> {
  await invoke("update_playlist_sort_order", { updates });
}

export async function removeCueFromPlaylistAPI(
  playlistItemId: string,
): Promise<void> {
  await invoke("remove_cue_from_playlist", { playlistItemId });
}
