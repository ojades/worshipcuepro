// /src/lib/commands/media-db.ts
import { invoke } from "@tauri-apps/api/core";
import type { Media } from "$lib/state/media.svelte";

export interface MediaInsert {
  id: string;
  filename: string;
  filepath: string;
  type: string;
  category: string;
}

export interface MediaPaths {
  filepath: string;
  thumbnail_path: string | null;
}

export async function fetchAllMediaAPI(): Promise<Media[]> {
  return await invoke<Media[]>("fetch_all_media");
}

export async function updateCategoryByNameAPI(
  oldName: string,
  newName: string,
): Promise<void> {
  await invoke("update_category_by_name", { oldName, newName });
}

export async function updateMediaThumbnailAPI(
  id: string,
  thumbnailPath: string,
): Promise<void> {
  await invoke("update_media_thumbnail", { id, thumbnailPath });
}

export async function bulkInsertMediaAPI(items: MediaInsert[]): Promise<void> {
  await invoke("bulk_insert_media", { items });
}

export async function bulkUpdateMediaCategoryAPI(
  ids: string[],
  newCategory: string,
): Promise<void> {
  await invoke("bulk_update_media_category", { ids, newCategory });
}

export async function fetchMediaPathsAPI(ids: string[]): Promise<MediaPaths[]> {
  return await invoke<MediaPaths[]>("fetch_media_paths", { ids });
}

export async function bulkDeleteMediaAPI(ids: string[]): Promise<void> {
  await invoke("bulk_delete_media", { ids });
}
