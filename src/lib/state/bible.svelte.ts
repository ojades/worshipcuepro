// /src/lib/state/bible.svelte.ts
import { bibleClient } from "$lib/api/bible-client";
import { youversionClient } from "$lib/api/youversion-client";
import { getDB } from "$lib/db";
import { settingsState } from "./settings.svelte";

const CACHE_TTL_MS = 20 * 24 * 60 * 60 * 1000; // 20 Days

const BOOK_NAMES = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
];
const BOOK_CODES = [
  "GEN",
  "EXO",
  "LEV",
  "NUM",
  "DEU",
  "JOS",
  "JDG",
  "RUT",
  "1SA",
  "2SA",
  "1KI",
  "2KI",
  "1CH",
  "2CH",
  "EZR",
  "NEH",
  "EST",
  "JOB",
  "PSA",
  "PRO",
  "ECC",
  "SNG",
  "ISA",
  "JER",
  "LAM",
  "EZK",
  "DAN",
  "HOS",
  "JOL",
  "AMO",
  "OBA",
  "JON",
  "MIC",
  "NAM",
  "HAB",
  "ZEP",
  "HAG",
  "ZEC",
  "MAL",
  "MAT",
  "MRK",
  "LUK",
  "JHN",
  "ACT",
  "ROM",
  "1CO",
  "2CO",
  "GAL",
  "EPH",
  "PHP",
  "COL",
  "1TH",
  "2TH",
  "1TI",
  "2TI",
  "TIT",
  "PHM",
  "HEB",
  "JAS",
  "1PE",
  "2PE",
  "1JN",
  "2JN",
  "3JN",
  "JUD",
  "REV",
];

// --- UNIFIED INTERFACES ---
export interface UnifiedBible {
  id: string;
  provider: "api.bible" | "youversion" | "system";
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
    if (prefixedId.startsWith("sys_")) {
      return {
        provider: "system" as const,
        originalId: prefixedId.replace(/^sys_/, ""),
      };
    }
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
        const enabledBibles = settingsState.config.enabledBibles;
        const firstEnabled = enabledBibles[0];
        await this.selectVersion(firstEnabled || this.versions[0].id);
      }
    }
  }

  // ----------------------------------------
  // SYSTEM BIBLE IMPORTER
  // ----------------------------------------
  /**
   * Feed this function the raw JSON array. It will organize it into the cache DB.
   * Call this during app startup (e.g., in a layout `+page.ts` or `onMount`).
   */
  async importSystemBible(jsonData: any[]) {
    if (!jsonData || jsonData.length === 0) return;

    const versionAbbr = jsonData[0].version;
    const prefixedId = `sys_${versionAbbr}`;
    const importFlagKey = `imported_${prefixedId}`;

    // Skip if we already imported this version
    const alreadyImported = await this.cacheDB.get(importFlagKey);
    if (alreadyImported) {
      console.log(`[System Bible] ${versionAbbr} already imported. Skipping.`);
      return;
    }

    console.log(
      `[System Bible] Importing ${versionAbbr}... This may take a moment.`,
    );

    // 1. Register the version in our system list
    let systemVersions =
      (await this.cacheDB.get<UnifiedBible[]>("system_bible_versions")) || [];
    if (!systemVersions.some((v) => v.id === prefixedId)) {
      systemVersions.push({
        id: prefixedId,
        provider: "system",
        originalId: versionAbbr,
        name: jsonData[0].name || `${versionAbbr} (Local)`,
        abbreviation: versionAbbr,
        language: jsonData[0].language || "eng",
      });
      await this.cacheDB.set(
        "system_bible_versions",
        systemVersions,
        10 * 365 * 24 * 60 * 60 * 1000,
      );
    }

    // 2. Group the flat JSON into Books -> Chapters -> Verses
    const booksMap = new Map<number, any>();

    for (const row of jsonData) {
      const bookNum = row.book;
      const chapNum = row.chapter;
      const bookUSM = BOOK_CODES[bookNum - 1];

      if (!booksMap.has(bookNum)) {
        booksMap.set(bookNum, {
          id: bookUSM,
          name: BOOK_NAMES[bookNum - 1],
          chapters: new Map(),
        });
      }

      const book = booksMap.get(bookNum);
      if (!book.chapters.has(chapNum)) {
        book.chapters.set(chapNum, []);
      }

      book.chapters.get(chapNum).push({
        id: `${bookUSM}.${chapNum}.${row.verse}`,
        reference: `${book.name} ${chapNum}:${row.verse}`,
        text: row.text,
      });
    }

    // 3. Write structured data to cache DB concurrently for MASSIVE speed boost
    const unifiedBooks: UnifiedBook[] = [];
    const dbPromises: Promise<void>[] = []; // Collect all DB inserts here

    for (const [bookNum, bookData] of booksMap.entries()) {
      const strBookId = bookData.id;
      unifiedBooks.push({ id: strBookId, name: bookData.name });

      const unifiedChapters: UnifiedChapter[] = [];

      for (const [chapNum, verses] of bookData.chapters.entries()) {
        const uniqueChapId = `${strBookId}.${chapNum}`;
        unifiedChapters.push({ id: uniqueChapId, number: chapNum.toString() });

        // Add verse insert to promise array (do not await here!)
        dbPromises.push(
          this.cacheDB.set(
            `verses_${prefixedId}_${uniqueChapId}`,
            verses,
            10 * 365 * 24 * 60 * 60 * 1000,
          ),
        );
      }

      // Add chapter list insert to promise array
      dbPromises.push(
        this.cacheDB.set(
          `chapters_${prefixedId}_${strBookId}`,
          unifiedChapters,
          10 * 365 * 24 * 60 * 60 * 1000,
        ),
      );
    }

    // Add book list and flag to promise array
    dbPromises.push(
      this.cacheDB.set(
        `books_${prefixedId}`,
        unifiedBooks,
        10 * 365 * 24 * 60 * 60 * 1000,
      ),
    );
    dbPromises.push(
      this.cacheDB.set(importFlagKey, true, 10 * 365 * 24 * 60 * 60 * 1000),
    );

    // Fire them all at once!
    await Promise.all(dbPromises);

    for (const dbTask of dbPromises) {
      await dbTask;
    }

    console.log(`[System Bible] ${versionAbbr} import complete!`);

    // await this.loadVersions();
  }

  /**
   * Parses an XML Bible file and feeds it into the system database importer.
   */
  async importXmlBible(xmlString: string, customAbbreviation?: string) {
    console.log("[System Bible] Parsing XML...");

    let sanitizedXml = xmlString.replace(/^\uFEFF/, "").trim();

    const firstBracket = sanitizedXml.indexOf("<");
    if (firstBracket > 0) {
      sanitizedXml = sanitizedXml.substring(firstBracket);
    }

    sanitizedXml = sanitizedXml
      .replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;")

      .replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]/g, "");

    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedXml, "application/xml");

    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      console.error("[System Bible] XML Parse Error:", parseError.textContent);
      throw new Error(
        `Failed to parse XML file. Reason: ${parseError.textContent}`,
      );
    }

    const bibleNode = doc.querySelector("bible");
    const translationName =
      bibleNode?.getAttribute("translation") || "Unknown XML Bible";

    const abbreviation =
      customAbbreviation ||
      translationName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .substring(0, 5) ||
      "XML";

    const jsonData: any[] = [];

    const books = doc.querySelectorAll("book");

    books.forEach((bookNode) => {
      const bookNumStr = bookNode.getAttribute("number");
      if (!bookNumStr) return;

      const bookNum = parseInt(bookNumStr, 10);

      const chapters = bookNode.querySelectorAll("chapter");
      chapters.forEach((chapterNode) => {
        const chapNumStr = chapterNode.getAttribute("number");
        if (!chapNumStr) return;

        const chapNum = parseInt(chapNumStr, 10);

        const verses = chapterNode.querySelectorAll("verse");
        verses.forEach((verseNode) => {
          const verseNumStr = verseNode.getAttribute("number");
          if (!verseNumStr) return;

          const verseNum = parseInt(verseNumStr, 10);
          const text = verseNode.textContent?.trim();

          if (text) {
            jsonData.push({
              version: abbreviation,
              name: translationName,
              language: "eng",
              book: bookNum,
              chapter: chapNum,
              verse: verseNum,
              text: text,
            });
          }
        });
      });
    });

    if (jsonData.length === 0) {
      throw new Error("No verses were found in the provided XML file.");
    }

    console.log(
      `[System Bible] XML parsed. Found ${jsonData.length} verses. Routing to DB Importer...`,
    );

    await this.importSystemBible(jsonData);
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

  async deleteSystemBible(prefixedId: string) {
    if (!prefixedId.startsWith("sys_")) return;

    console.log(`[System Bible] Deleting translation ${prefixedId}...`);
    this.isLoading = true;

    try {
      const db = getDB();

      // 1. Delete all cached books, chapters, verses, and the import flag from SQLite
      // We use SQL LIKE operators to match all the dynamically generated cache keys for this translation
      await db.execute(
        `DELETE FROM bible_cache WHERE
             cache_key = $1 OR
             cache_key = $2 OR
             cache_key LIKE $3 OR
             cache_key LIKE $4`,
        [
          `imported_${prefixedId}`,
          `books_${prefixedId}`,
          `chapters_${prefixedId}_%`,
          `verses_${prefixedId}_%`,
        ],
      );

      // 2. Remove it from the registered system versions array
      const systemVersions =
        (await this.cacheDB.get<UnifiedBible[]>("system_bible_versions")) || [];
      const updatedSystemVersions = systemVersions.filter(
        (v) => v.id !== prefixedId,
      );
      await this.cacheDB.set(
        "system_bible_versions",
        updatedSystemVersions,
        10 * 365 * 24 * 60 * 60 * 1000,
      );

      // 3. Clear the unified memory and DB cache so the UI updates
      await this.cacheDB.delete("unified_bible_versions");

      // 4. Deselect if it's currently active
      if (this.selectedVersion === prefixedId) {
        this.selectedVersion = null;
        this.selectedBook = null;
        this.selectedChapter = null;
        this.verses = [];
      }

      // 5. Force a full reload to reflect the deleted state
      await this.refreshVersions();
      console.log(`[System Bible] ${prefixedId} successfully deleted.`);
    } catch (err) {
      console.error("[System Bible] Failed to delete translation:", err);
    } finally {
      this.isLoading = false;
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

    await this.cacheDB.delete("unified_bible_versions");
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
      const fetchWithTimeout = async (
        promise: Promise<any>,
        timeoutMs = 4000,
      ) => {
        let timeoutId: any;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("Network timeout or offline")),
            timeoutMs,
          );
        });
        try {
          const result = await Promise.race([promise, timeoutPromise]);
          clearTimeout(timeoutId);
          return result;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      // Fetch System Bibles from cache instantly, wrap external APIs with a fast timeout
      const [sysVersions, abVersions, yvVersions] = await Promise.allSettled([
        this.cacheDB.get<UnifiedBible[]>("system_bible_versions"),
        fetchWithTimeout(bibleClient.getVersions()),
        fetchWithTimeout(youversionClient.getVersions()),
      ]);

      let unifiedList: UnifiedBible[] = [];

      // 1. Load System (Local) Bibles first (Guaranteed to work offline)
      if (sysVersions.status === "fulfilled" && sysVersions.value) {
        unifiedList.push(...sysVersions.value);
      } else {
        console.log("No local system Bibles found in cache.");
      }

      // 2. Safely add API.Bible if online
      if (abVersions.status === "fulfilled") {
        unifiedList.push(
          ...abVersions.value.map((v: any) => ({
            id: `ab_${v.id}`,
            provider: "api.bible" as const,
            originalId: v.id,
            name: v.name,
            abbreviation: v.abbreviationLocal || v.abbreviation,
            language: v.language.id,
          })),
        );
      } else {
        console.warn(
          "ApiBible offline or failed:",
          abVersions.reason?.message || abVersions.reason,
        );
      }

      // 3. Safely add YouVersion if online
      if (yvVersions.status === "fulfilled") {
        unifiedList.push(
          ...yvVersions.value.map((v: any) => ({
            id: `yv_${v.id}`,
            provider: "youversion" as const,
            originalId: v.id.toString(),
            name: v.title,
            abbreviation: v.abbreviation,
            language: v.language_tag,
          })),
        );
      } else {
        console.warn(
          "YouVersion offline or failed:",
          yvVersions.reason?.message || yvVersions.reason,
        );
      }

      // Ensure we have at least something to show
      if (unifiedList.length === 0) {
        throw new Error(
          "No Bibles available online or offline. Please import a system Bible.",
        );
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
      console.error("[BibleState] Failed to load versions:", e.message);
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
        await this.cacheDB.set("last_used_bible", prefixedId);
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
    set: async (key: string, payload: any, customTtlMs?: number) => {
      try {
        const db = getDB();
        const timestamp = customTtlMs ? Date.now() + customTtlMs : Date.now();
        await db.execute(
          "INSERT OR REPLACE INTO bible_cache (cache_key, data, timestamp) VALUES ($1, $2, $3)",
          [key, JSON.stringify(payload), timestamp],
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
