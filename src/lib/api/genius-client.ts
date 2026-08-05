import { settingsState } from "$lib/state/settings.svelte";
import { invoke } from "@tauri-apps/api/core";

export interface GeniusSearchResult {
  id: number;
  title: string;
  artist: string;
  url: string;
  imageUrl: string;
}

export const geniusClient = {
  // You should store the API key in your SQLite settings DB so the user can provide their own,
  // or provide a default one if you have a developer token.
  async search(query: string, apiKey: string): Promise<GeniusSearchResult[]> {
    try {
      return await invoke("search_genius", { query, apiKey });
    } catch (error) {
      console.error("Genius search failed:", error);
      return [];
    }
  },

  async getLyrics(url: string): Promise<string | null> {
    try {
      const lyrics: string = await invoke("scrape_genius_lyrics", { url });
      return lyrics;
    } catch (error) {
      console.error("Failed to scrape lyrics:", error);
      return null;
    }
  },
};
