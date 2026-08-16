// src/lib/state/settings.svelte.ts
import { browser } from "$app/environment";
import type { AppSettings, TextFormatConfig } from "$lib/types/models";
import { mkdir } from "@tauri-apps/plugin-fs";
import { getDbSettingAPI, setDbSettingAPI } from "$lib/commands/settings-db";

const DEFAULT_FORMAT: TextFormatConfig = {
  fontFamily: "sans-serif",
  fontSizeScale: 1.0,
  textTransform: "uppercase",
  fontWeight: "bold",
  letterSpacing: 0,
  lineHeight: 1.2,
  textAlign: "center",
  textStrokeWidth: 2,
  textStrokeColor: "#000000",
  dropShadow: true,
};

export const DEFAULT_SETTINGS: AppSettings = {
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
    vGap: 5,
    referencePosition: "bottom-right",
    textFormat: DEFAULT_FORMAT,
  },
  stage: {
    textScale: 1,
    textVAlign: "middle",
    vGap: 0,
    referencePosition: "bottom-right",
    textFormat: {
      ...DEFAULT_FORMAT,
      textTransform: "none",
      textStrokeWidth: 0,
    },
  },
  obsTemplates: {
    lyric: "",
    bible: "",
  },
};

class SettingsState {
  config = $state<AppSettings>({ ...DEFAULT_SETTINGS });
  workspacePath = $state<string>("");

  async init() {
    if (!browser) return;

    try {
      const dbConfig = await this.getDbSetting("app_config");

      if (dbConfig) {
        this.config = { ...DEFAULT_SETTINGS, ...JSON.parse(dbConfig) };
      } else {
        const localConfig = localStorage.getItem("wcp_settings");
        if (localConfig) {
          console.log(
            "[Settings] Migrating localStorage settings to SQLite Database...",
          );
          this.config = { ...DEFAULT_SETTINGS, ...JSON.parse(localConfig) };
          await this.saveSettings();
        }
      }

      if (localStorage.getItem("wcp_settings")) {
        localStorage.removeItem("wcp_settings");
        console.log("[Settings] Cleared legacy localStorage data.");
      }
    } catch (e) {
      console.error("Failed to initialize settings from DB:", e);
    }
  }

  private async saveSettings() {
    if (!browser) return;
    try {
      await this.setDbSetting("app_config", JSON.stringify(this.config));
    } catch (e) {
      console.error("Failed to save settings to DB:", e);
    }
  }

  update(updates: Partial<AppSettings>) {
    this.config = { ...this.config, ...updates };
    this.saveSettings().catch(console.error);
  }

  async clearLocalCache() {
    if (!browser) return;

    this.config = { ...DEFAULT_SETTINGS };
    localStorage.clear();
    await this.saveSettings();
  }

  exportSettings(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importSettings(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);

      // Clean out legacy workspace paths just in case an old export had them
      delete parsed.workspacePath;

      this.config = {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };

      this.saveSettings().catch(console.error);
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

  async getDbSetting(key: string, defaultValue: string = ""): Promise<string> {
    try {
      const res = await getDbSettingAPI(key);
      return res ?? defaultValue;
    } catch (e) {
      console.error(`Failed to fetch DB setting for key: ${key}`, e);
      return defaultValue;
    }
  }

  async setDbSetting(key: string, value: string): Promise<boolean> {
    try {
      await setDbSettingAPI(key, value);
      return true;
    } catch (e) {
      console.error(`Failed to save DB setting for key: ${key}`, e);
      return false;
    }
  }
}

export const settingsState = new SettingsState();
