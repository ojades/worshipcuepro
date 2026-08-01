// src/lib/commands/display.ts
import { invoke } from "@tauri-apps/api/core";
import type { DisplayInfo } from "$lib/state/system.svelte.ts";

export async function fetchSystemDisplays(): Promise<DisplayInfo[]> {
  return await invoke("get_displays");
}

export async function launchProjectorWindow(
  monitorName?: string,
): Promise<void> {
  return await invoke("launch_projector", { monitorName });
}

export async function closeProjectorWindow(): Promise<void> {
  return await invoke("close_projector");
}

export async function checkProjectorStatus(): Promise<boolean> {
  return await invoke("is_projector_open");
}

export async function launchStageWindow(monitorName?: string): Promise<void> {
  return await invoke("launch_stage", { monitorName });
}

export async function closeStageWindow(): Promise<void> {
  return await invoke("close_stage");
}

export async function checkStageStatus(): Promise<boolean> {
  return await invoke("is_stage_open");
}
