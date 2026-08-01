// /src/lib/api/youversion-client.ts
import { invoke } from "@tauri-apps/api/core";

export const youversionClient = {
  getVersions: async () => {
    return invoke<any[]>("get_youversion_versions");
  },

  getIndex: async (bibleId: string) => {
    return invoke<any>("get_youversion_index", { bibleId });
  },

  getVerses: async (bibleId: string, passageId: string) => {
    return invoke<any>("get_youversion_verses", { bibleId, passageId });
  },
};
