// src/lib/state/settings.svelte.ts
import { browser } from "$app/environment";
import type { AppSettings } from "$lib/types/models";
import { mkdir } from "@tauri-apps/plugin-fs";

export const DEFAULT_SETTINGS: AppSettings = {
  workspacePath: null,
  enabledBibles: [
    "ab_de4e12af7f28f599-01",
    "ab_d6e14a625393b4da-01",
    "ab_06125adad2d5898a-01",
    "ab_6f11a7de016f942e-01",
    "ab_63097d2a0a2f7db3-01",
    "sys_NIV",
    "sys_NKJV",
  ],
  projector: {
    textScale: 1,
    textVAlign: "top",
    referencePosition: "bottom-right",
  },
  stage: {
    textScale: 1,
    textVAlign: "middle",
    referencePosition: "bottom-right",
  },
};

class SettingsState {
  config = $state<AppSettings>({ ...DEFAULT_SETTINGS });

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    if (!browser) return;

    try {
      const stored = localStorage.getItem("wcp_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }

  private saveSettings() {
    if (browser) {
      localStorage.setItem("wcp_settings", JSON.stringify(this.config));
    }
  }

  // Update one or more settings at once
  update(updates: Partial<AppSettings>) {
    this.config = { ...this.config, ...updates };
    this.saveSettings();
  }

  // For future use: Exporting and Importing
  exportSettings(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importSettings(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      this.config = { ...DEFAULT_SETTINGS, ...parsed };
      this.saveSettings();
      return true;
    } catch (e) {
      console.error("Failed to import settings:", e);
      return false;
    }
  }

  async parseWorkspaceDir(dirPath: string): Promise<string> {
    const folderName = dirPath.split(/[/\\]/).pop();

    if (folderName?.toLowerCase() !== "worshipcuepro") {
      const newPath = `${dirPath}/worshipcuepro`;
      await mkdir(newPath, { recursive: true });
      return newPath;
    }

    return dirPath;
  }
}

export const settingsState = new SettingsState();
