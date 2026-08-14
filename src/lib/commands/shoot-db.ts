// /src/lib/commands/shoot-db.ts
import { invoke } from "@tauri-apps/api/core";

export interface ShootMeta {
  id: string;
  title: string;
  slideCount: number;
}

export interface ShootSlideRow {
  id: string;
  media_id: string;
  filepath: string;
  media_type: string;
  sort_order: number;
  text_content?: string;
}

export interface SlideInsert {
  media_id: string;
}

export interface FullShoot {
  id: string;
  title: string;
}

export async function fetchAllShootsAPI(): Promise<ShootMeta[]> {
  return await invoke<ShootMeta[]>("fetch_all_shoots");
}

export async function fetchShootSlidesAPI(
  shootId: string,
): Promise<ShootSlideRow[]> {
  return await invoke<ShootSlideRow[]>("fetch_shoot_slides", { shootId });
}

export async function saveShootAPI(
  id: string,
  title: string,
  slides: SlideInsert[],
): Promise<void> {
  await invoke("save_shoot", { id, title, slides });
}

export async function deleteShootAPI(id: string): Promise<void> {
  await invoke("delete_shoot", { id });
}

export async function fetchShootAPI(
  shootId: string,
): Promise<FullShoot | null> {
  return await invoke<FullShoot | null>("fetch_shoot", { shootId });
}
