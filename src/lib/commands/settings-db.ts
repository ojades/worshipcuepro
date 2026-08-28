// /src/lib/commands/settings-db.ts
import { invoke } from "@tauri-apps/api/core";

export async function getDbSettingAPI(key: string): Promise<string | null> {
  return await invoke<string | null>("get_db_setting", { key });
}

export async function setDbSettingAPI(
  key: string,
  value: string,
): Promise<void> {
  await invoke("set_db_setting", { key, value });
}

export async function setCoreWorkspaceAPI(
  path: string,
  dbPath: string | null = null,
  tursoUrl: string | null = null,
  tursoToken: string | null = null,
): Promise<void> {
  await invoke("set_core_workspace", { path, dbPath, tursoUrl, tursoToken });
}

export async function getCoreWorkspaceAPI(): Promise<string | null> {
  return await invoke<string | null>("get_core_workspace");
}
