// /src/lib/commands/bible-db.ts
import { invoke } from "@tauri-apps/api/core";

export interface BibleCacheEntry {
  data: string;
  timestamp: number;
}

export async function getBibleCacheAPI(
  key: string,
): Promise<BibleCacheEntry | null> {
  return await invoke<BibleCacheEntry | null>("get_bible_cache", { key });
}

export async function setBibleCacheAPI(
  key: string,
  data: string,
  timestamp: number,
): Promise<void> {
  await invoke("set_bible_cache", { key, data, timestamp });
}

export async function deleteBibleCacheAPI(key: string): Promise<void> {
  await invoke("delete_bible_cache", { key });
}

export async function clearBibleCacheAPI(): Promise<void> {
  await invoke("clear_bible_cache");
}

export async function deleteSystemBibleCacheAPI(
  prefixedId: string,
): Promise<void> {
  await invoke("delete_system_bible_cache", { prefixedId });
}
