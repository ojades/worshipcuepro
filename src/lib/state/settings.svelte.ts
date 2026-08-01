// src/lib/state/settings.svelte.ts
import { browser } from "$app/environment";

export interface AppSettings {
  workspacePath: string | null;
  projectorAlignment: "top" | "middle" | "bottom";
  apiBibleKey: string;
  youVersionToken: string;
  linesPerSlide: number;
  enabledBibles: string[];
  textScale?: number;
  stageTextScale?: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  workspacePath: null,
  projectorAlignment: "middle",
  apiBibleKey: "t6-Nc3fL1BAcuJrr-_yDc",
  youVersionToken: "hW9IGDSGcXDSZgs1e9dFBORdHxOAGtM8IRIVmEujmMsY5VXA",
  linesPerSlide: 2,
  enabledBibles: ["NLT", "KJV", "ASV", "MSG", "engKJV"],
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
      } else {
        // First-time run with the new system: migrate old data if it exists
        this.migrateOldSettings();
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }

  private migrateOldSettings() {
    if (!browser) return;

    const oldWorkspace = localStorage.getItem("wcp_workspace_path");
    const oldAlignment = localStorage.getItem("projector_alignment");

    if (oldWorkspace || oldAlignment) {
      this.config.workspacePath = oldWorkspace;
      if (
        oldAlignment === "top" ||
        oldAlignment === "middle" ||
        oldAlignment === "bottom"
      ) {
        this.config.projectorAlignment = oldAlignment;
      }

      this.saveSettings();

      // Clean up legacy keys
      localStorage.removeItem("wcp_workspace_path");
      localStorage.removeItem("projector_alignment");
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
}

export const settingsState = new SettingsState();
