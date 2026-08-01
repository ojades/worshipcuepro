// /src/lib/state/bible.svelte.ts
import { bibleClient } from "$lib/api/bible-client";
import { youversionClient } from "$lib/api/youversion-client";
import { getDB } from "$lib/db";

const CACHE_TTL_MS = 20 * 24 * 60 * 60 * 1000; // 20 Days

// --- UNIFIED INTERFACES ---
export interface UnifiedBible {
  id: string;
  provider: "api.bible" | "youversion";
  originalId: string;
  name: string;
  abbreviation: string;
  language: string;
}

export interface UnifiedBook {
  id: string;
  name: string;
}

export interface UnifiedChapter {
  id: string;
  number: string;
}

export interface UnifiedVerse {
  id: string;
  reference: string;
  text: string | null;
}

class BibleState {
  // ----------------------------------------
  // CACHE (Non-reactive to save memory/perf)
  // ----------------------------------------
  private versionsCache: UnifiedBible[] | null = null;
  private booksCache = new Map<string, UnifiedBook[]>();
  private chaptersCache = new Map<string, UnifiedChapter[]>();
  private versesCache = new Map<string, UnifiedVerse[]>();

  // ----------------------------------------
  // UI STATE (Reactive)
  // ----------------------------------------
  versions = $state<UnifiedBible[]>([]);
  books = $state<UnifiedBook[]>([]);
  chapters = $state<UnifiedChapter[]>([]);
  verses = $state<UnifiedVerse[]>([]);

  selectedVersion = $state<string | null>(null);
  selectedBook = $state<string | null>(null);
  selectedChapter = $state<string | null>(null);

  isLoading = $state(false);
  error = $state<string | null>(null);
  pendingScrollVerse = $state<string | null>(null);

  // ----------------------------------------
  // INITIALIZATION & ROUTING HELPERS
  // ----------------------------------------

  private getProviderAndId(prefixedId: string) {
    const isApiBible = prefixedId.startsWith("ab_");
    const originalId = prefixedId.replace(/^(ab_|yv_)/, "");
    return { provider: isApiBible ? "api.bible" : "youversion", originalId };
  }

  async init() {
    await this.loadVersions();

    if (this.versions.length > 0) {
      const lastVersion = await this.cacheDB.get<string>("last_used_bible");
      if (lastVersion && this.versions.some((v) => v.id === lastVersion)) {
        await this.selectVersion(lastVersion);
      } else {
        await this.selectVersion(this.versions[0].id);
      }
    }
  }

  async goToReference(
    bookId: string,
    chapterNum: string | number,
    verseNum?: string | number,
  ) {
    if (!this.selectedVersion) await this.init();

    await this.selectBook(bookId);

    const chapterStr = chapterNum.toString();
    const targetChapter = this.chapters.find((c) => c.number === chapterStr);

    if (targetChapter) {
      await this.selectChapter(targetChapter.id);
      if (verseNum) {
        this.pendingScrollVerse = verseNum.toString();
      }
    }
  }

  // ----------------------------------------
  // DATA FETCHING (THE ADAPTER PATTERN)
  // ----------------------------------------
  async refreshVersions() {
    console.log("Forcing refresh of Bible versions...");
    this.isLoading = true;

    this.versionsCache = null;
    this.versionsCache = null;
    this.booksCache.clear();
    this.chaptersCache.clear();
    this.versesCache.clear();

    await this.cacheDB.clearAll();

    await this.loadVersions();
  }

  async loadVersions() {
    const cacheKey = "unified_bible_versions";

    if (this.versionsCache) {
      this.versions = this.versionsCache;
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const cachedData = await this.cacheDB.get<UnifiedBible[]>(cacheKey);
      if (cachedData) {
        this.versionsCache = cachedData;
        this.versions = cachedData;
        return;
      }

      const [abVersions, yvVersions] = await Promise.allSettled([
        bibleClient.getVersions(),
        youversionClient.getVersions(),
      ]);

      let unifiedList: UnifiedBible[] = [];

      if (abVersions.status === "fulfilled") {
        unifiedList.push(
          ...abVersions.value.map((v) => ({
            id: `ab_${v.id}`,
            provider: "api.bible" as const,
            originalId: v.id,
            name: v.name,
            abbreviation: v.abbreviationLocal || v.abbreviation,
            language: v.language.id,
          })),
        );
      } else {
        console.log("ApiBible call failed: ", abVersions.reason);
      }

      if (yvVersions.status === "fulfilled") {
        unifiedList.push(
          ...yvVersions.value.map((v) => ({
            id: `yv_${v.id}`,
            provider: "youversion" as const,
            originalId: v.id.toString(),
            name: v.title,
            abbreviation: v.abbreviation,
            language: v.language_tag,
          })),
        );
      } else {
        console.log("YouVersion call failed: ", yvVersions.reason);
      }

      const uniqueVersions = new Map<string, UnifiedBible>();
      for (const version of unifiedList) {
        const dedupeKey =
          `${version.language}_${version.abbreviation}`.toLowerCase();
        if (!uniqueVersions.has(dedupeKey)) {
          uniqueVersions.set(dedupeKey, version);
        }
      }

      const finalVersions = Array.from(uniqueVersions.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      this.versionsCache = finalVersions;
      this.versions = finalVersions;
      await this.cacheDB.set(cacheKey, finalVersions);
    } catch (e: any) {
      this.error = e.message;
      console.error(e.message);
    } finally {
      this.isLoading = false;
    }
  }

  async selectVersion(prefixedId: string) {
    this.selectedVersion = prefixedId;
    this.selectedBook = null;
    this.selectedChapter = null;
    this.chapters = [];
    this.verses = [];

    const { provider, originalId } = this.getProviderAndId(prefixedId);
    const cacheKey = `books_${prefixedId}`;

    if (this.booksCache.has(prefixedId)) {
      this.books = this.booksCache.get(prefixedId)!;
      return;
    }

    this.books = [];
    this.isLoading = true;
    this.error = null;

    try {
      const cachedData = await this.cacheDB.get<UnifiedBook[]>(cacheKey);
      if (cachedData) {
        this.booksCache.set(prefixedId, cachedData);
        this.books = cachedData;
        return;
      }

      let mappedBooks: UnifiedBook[] = [];

      // ADAPTER ROUTING
      if (provider === "api.bible") {
        // api.bible still lazy-loads books
        const rawBooks = await bibleClient.getBooks(originalId);
        mappedBooks = rawBooks.map((b) => ({ id: b.id, name: b.name }));
      } else {
        // YouVersion bulk-loads books AND chapters via the new index endpoint
        const indexData = await youversionClient.getIndex(originalId);

        // Map the books
        mappedBooks = indexData.books.map((b: any) => ({
          id: b.id,
          name: b.title || b.full_title || "Unknown",
        }));

        await this.cacheDB.set(
          `yv_master_index_${prefixedId}`,
          indexData.books,
        );

        for (const book of indexData.books) {
          const mappedChapters = book.chapters.map((c: any) => ({
            id: c.passage_id,
            number: c.title?.toString(),
          }));

          const chapterCacheKey = `chapters_${prefixedId}_${book.id}`;
          this.chaptersCache.set(chapterCacheKey, mappedChapters);

          this.cacheDB
            .set(chapterCacheKey, mappedChapters)
            .catch(console.error);
        }
      }

      this.booksCache.set(prefixedId, mappedBooks);
      this.books = mappedBooks;
      await this.cacheDB.set(cacheKey, mappedBooks);
      await this.cacheDB.set("last_used_bible", prefixedId);
    } catch (e: any) {
      this.error = e.message;
      console.error(this.error);
    } finally {
      this.isLoading = false;
    }
  }

  async selectBook(bookId: string) {
    if (!this.selectedVersion) return;

    this.selectedBook = bookId;
    this.selectedChapter = null;
    this.verses = [];

    const { provider, originalId: versionOriginalId } = this.getProviderAndId(
      this.selectedVersion,
    );
    const cacheKey = `chapters_${this.selectedVersion}_${bookId}`;

    if (this.chaptersCache.has(cacheKey)) {
      this.chapters = this.chaptersCache.get(cacheKey)!;
      return;
    }

    this.chapters = [];
    this.isLoading = true;
    this.error = null;
    try {
      const cachedData = await this.cacheDB.get<UnifiedChapter[]>(cacheKey);
      if (cachedData) {
        this.chaptersCache.set(cacheKey, cachedData);
        this.chapters = cachedData;
        return;
      }

      let mappedChapters: UnifiedChapter[] = [];

      // ADAPTER ROUTING
      if (provider === "api.bible") {
        const rawChapters = await bibleClient.getChapters(
          versionOriginalId,
          bookId,
        );
        mappedChapters = rawChapters.map((c) => ({
          id: c.id,
          number: c.number,
        }));
      }

      this.chaptersCache.set(cacheKey, mappedChapters);
      this.chapters = mappedChapters;
      await this.cacheDB.set(cacheKey, mappedChapters);
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.isLoading = false;
    }
  }

  async selectChapter(chapterId: string) {
    if (!this.selectedVersion) return;

    this.selectedChapter = chapterId;

    const { provider, originalId: versionOriginalId } = this.getProviderAndId(
      this.selectedVersion,
    );
    const cacheKey = `verses_${this.selectedVersion}_${chapterId}`;

    if (this.versesCache.has(cacheKey)) {
      this.verses = this.versesCache.get(cacheKey)!;
      return;
    }

    this.verses = [];
    this.isLoading = true;
    this.error = null;

    try {
      const cachedData = await this.cacheDB.get<UnifiedVerse[]>(cacheKey);
      if (cachedData) {
        this.verses = cachedData;
        this.versesCache.set(cacheKey, cachedData);
        return;
      }

      let mappedVerses: UnifiedVerse[] = [];

      // ADAPTER ROUTING
      if (provider === "api.bible") {
        const rawVerses = await bibleClient.getVerses(
          versionOriginalId,
          chapterId,
        );
        mappedVerses = rawVerses.map((v) => ({
          id: v.id,
          reference: v.reference,
          text: v.text,
        }));
      } else {
        const bookId = this.selectedBook;
        const masterIndex = await this.cacheDB.get<any[]>(
          `yv_master_index_${this.selectedVersion}`,
        );

        if (masterIndex) {
          const book = masterIndex.find((b) => b.id === bookId);
          const chapter = book?.chapters.find(
            (c: any) => c.passage_id === chapterId,
          );

          if (chapter && chapter.verses) {
            mappedVerses = chapter.verses.map((v: any) => ({
              id: v.passage_id,
              reference: v.title?.toString() || v.id?.toString(),
              text: null,
            }));
          }
        }
      }

      this.verses = mappedVerses;
      this.versesCache.set(cacheKey, mappedVerses);
      await this.cacheDB.set(cacheKey, mappedVerses);
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.isLoading = false;
    }
  }

  async resolveVerseText(verseId: string) {
    // Find the verse in our current state
    const verseIndex = this.verses.findIndex((v) => v.id === verseId);
    if (verseIndex === -1) return null;

    const verse = this.verses[verseIndex];

    // If we already have the text (api.bible, or already fetched), return it instantly
    if (verse.text) return verse.text;

    const { provider, originalId } = this.getProviderAndId(
      this.selectedVersion!,
    );

    if (provider === "youversion") {
      try {
        // Fetch the individual verse from YouVersion (e.g., JHN.3.16)
        const rawVerse = await youversionClient.getVerses(originalId, verseId);

        // Update the state so we don't have to fetch it again
        this.verses[verseIndex].text = rawVerse.content;
        this.verses[verseIndex].reference = rawVerse.reference;

        // Update caches
        const cacheKey = `verses_${this.selectedVersion}_${this.selectedChapter}`;
        this.versesCache.set(cacheKey, this.verses);
        this.cacheDB.set(cacheKey, this.verses).catch(console.error);

        return rawVerse.content;
      } catch (err) {
        console.error("Failed to fetch verse text:", err);
        return "Error loading text";
      }
    }
  }

  // ----------------------------------------
  // DB HELPER LAYER
  // ----------------------------------------
  private cacheDB = {
    get: async <T>(key: string): Promise<T | null> => {
      try {
        const db = getDB();
        const result = await db.select<{ data: string; timestamp: number }[]>(
          "SELECT data, timestamp FROM bible_cache WHERE cache_key = $1",
          [key],
        );

        if (result.length === 0) return null;

        const { data, timestamp } = result[0];

        if (Date.now() - timestamp > CACHE_TTL_MS) {
          await this.cacheDB.delete(key);
          return null;
        }

        return JSON.parse(data) as T;
      } catch (err) {
        console.error(`[BibleCache] Error reading key: ${key}`, err);
        return null;
      }
    },
    set: async (key: string, payload: any) => {
      try {
        const db = getDB();
        await db.execute(
          "INSERT OR REPLACE INTO bible_cache (cache_key, data, timestamp) VALUES ($1, $2, $3)",
          [key, JSON.stringify(payload), Date.now()],
        );
      } catch (err) {
        console.error(`[BibleCache] Error writing key: ${key}`, err);
      }
    },
    delete: async (key: string) => {
      try {
        const db = getDB();
        await db.execute("DELETE FROM bible_cache WHERE cache_key = $1", [key]);
      } catch (err) {
        console.error(`[BibleCache] Error deleting key: ${key}`, err);
      }
    },
    clearAll: async () => {
      try {
        const db = getDB();
        await db.execute("DELETE FROM bible_cache");
      } catch (err) {
        console.error(`[BibleCache] Error clearing all cache`, err);
      }
    },
  };
}

export const bibleState = new BibleState();
