// /src/lib/api/bible-client.ts

import { invoke } from "@tauri-apps/api/core";

export const bibleClient = {
  getVersions: async () => {
    return invoke<any[]>("get_bible_versions");
  },

  getBooks: async (bibleId: string) => {
    return invoke<any[]>("get_bible_books", { bibleId });
  },

  getChapters: async (bibleId: string, bookId: string) => {
    return invoke<any[]>("get_bible_chapters", { bibleId, bookId });
  },

  // Get verses for a specific chapter (HYDRATED WITH TEXT)
  getVerses: async (bibleId: string, chapterId: string) => {
    const response = await invoke<{ verses: any[]; chapter_html: string }>(
      "get_bible_verses",
      { bibleId, chapterId },
    );

    const verses = response.verses;
    const chapterHtml = response.chapter_html;

    // Parse the HTML returned by Rust to extract individual verses.
    const parser = new DOMParser();
    const doc = parser.parseFromString(chapterHtml, "text/html");

    return verses.map((verse) => {
      const verseElements = doc.querySelectorAll(
        `span[data-verse-id="${verse.id}"]`,
      );

      let verseText = "";
      verseElements.forEach((el) => {
        const textNodes = Array.from(el.childNodes)
          .filter(
            (node) =>
              node.nodeType === Node.TEXT_NODE ||
              (node as Element).className !== "v",
          )
          .map((node) => node.textContent?.trim())
          .join(" ");

        verseText += textNodes + " ";
      });

      return {
        ...verse,
        text: verseText.trim() || "Text not available in this translation.",
      };
    });
  },

  getVerseText: async (bibleId: string, verseId: string) => {
    return invoke<any>("get_bible_verse_text", { bibleId, verseId });
  },
};
