// /src/lib/commands/bible-db.ts
import { invoke } from "@tauri-apps/api/core";

export interface BibleCacheEntry {
  data: string;
  timestamp: number;
}

export interface FtsVerseInsert {
  reference: string;
  text: string;
}

export interface FtsSearchResult {
  reference: string;
  text: string;
  full_text: string;
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

export interface FtsVerseInsert {
  reference: string;
  text: string;
}

export interface FtsSearchResult {
  reference: string;
  text: string;
}

export async function bulkInsertBibleFtsAPI(
  version: string,
  verses: FtsVerseInsert[],
): Promise<void> {
  await invoke("bulk_insert_bible_fts", { version, verses });
}

export async function searchBibleFtsAPI(
  version: string,
  queryString: string,
  limit: number = 50,
): Promise<FtsSearchResult[]> {
  return await invoke<FtsSearchResult[]>("search_bible_fts", {
    version,
    queryString,
    limit,
  });
}

export async function deleteBibleFtsVersionAPI(version: string): Promise<void> {
  await invoke("delete_bible_fts_version", { version });
}
