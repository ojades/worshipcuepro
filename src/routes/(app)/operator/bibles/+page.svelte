<!-- /src/routes/operator/bibles/+page.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import {
        Search,
        Play,
        Loader2,
        BookOpen,
        ChevronDown,
    } from "@lucide/svelte";
    import { bibleState } from "$lib/state/bible.svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import { goto } from "$app/navigation";
    import { chunkProse } from "$lib/utils/helper";
    import type { FtsSearchResult } from "$lib/commands/bible-db";

    // Local UI State
    let searchInput: HTMLInputElement;
    let smartQuery = $state("");
    let hoveredVerseId = $state<string | null>(null);
    let isTranslationOpen = $state(false);
    let lastScrolledVerse = $state<number | null>(null);
    const fetchingVerses = new Set<string>();

    // --- NEW: Search State ---
    let searchResults = $state<FtsSearchResult[]>([]);
    let isSearching = $state(false);
    let searchTimeout: ReturnType<typeof setTimeout>;

    onMount(() => {
        if (bibleState.versions.length === 0) {
            bibleState.loadVersions();
        }
    });

    let enabledVersions = $derived.by(() => {
        const enabledIds = (settingsState.config as any).enabledBibles || [];
        if (enabledIds.length === 0) return bibleState.versions;
        return bibleState.versions.filter((v) => enabledIds.includes(v.id));
    });

    let parsedQuery = $derived.by(() => {
        const q = smartQuery.trimStart().toLowerCase();
        const regex =
            /^(\d?\s*[a-z]+(?:[\s-]*[a-z]+)*)\s*(?:(\d+)\s*(?:[:\s]\s*(\d+))?)?$/i;
        const match = q.match(regex);

        if (!match) return { book: q, chapter: null, verse: null };
        return {
            book: match[1]?.trim() || q,
            chapter: match[2] ? parseInt(match[2]) : null,
            verse: match[3] ? parseInt(match[3]) : null,
        };
    });

    let filteredBooks = $derived(
        bibleState.books.filter((book) =>
            book.name?.toLowerCase().includes(parsedQuery.book),
        ),
    );

    // --- NEW: Unified Command Bar Logic (Nav vs Search) ---
    $effect(() => {
        const query = smartQuery.trim();
        // Heuristic: If query > 2 chars and doesn't match any book, it's a phrase search
        if (query.length > 2 && filteredBooks.length === 0) {
            isSearching = true;
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                searchResults = await bibleState.search(query, 50);
                isSearching = false;
            }, 200); // 200ms debounce
        } else {
            searchResults = [];
            isSearching = false;
        }
    });

    $effect(() => {
        const parts = smartQuery.trimStart().split(" ");
        if (parts.length > 1) {
            const firstWord = parts[0].toLowerCase();
            const matchedVersion = enabledVersions.find(
                (v) => v.abbreviation?.toLowerCase() === firstWord,
            );

            if (matchedVersion) {
                if (bibleState.selectedVersion !== matchedVersion.id) {
                    bibleState.switchBibleVersionLive(matchedVersion.id);
                }
                smartQuery = smartQuery.substring(firstWord.length).trimStart();
            }
        }
    });

    function lazyLoadVerse(node: HTMLElement, verseId: string) {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    const verse = bibleState.verses.find(
                        (v) => v.id === verseId,
                    );
                    if (
                        verse &&
                        verse.text === null &&
                        !fetchingVerses.has(verseId)
                    ) {
                        fetchingVerses.add(verseId);
                        bibleState.resolveVerseText(verseId).finally(() => {
                            fetchingVerses.delete(verseId);
                        });
                    }
                }
            },
            { root: null, rootMargin: "200px" },
        );
        observer.observe(node);
        return {
            destroy() {
                observer.disconnect();
            },
        };
    }

    $effect(() => {
        if (parsedQuery.book && searchResults.length === 0) {
            const exactMatch = filteredBooks.find(
                (b) => b.name?.toLowerCase() === parsedQuery.book,
            );
            if (exactMatch) {
                if (bibleState.selectedBook !== exactMatch.id)
                    bibleState.selectBook(exactMatch.id);
            } else if (filteredBooks.length === 1) {
                const targetBook = filteredBooks[0];
                if (bibleState.selectedBook !== targetBook.id)
                    bibleState.selectBook(targetBook.id);
            }
        }
    });

    $effect(() => {
        if (
            bibleState.selectedBook &&
            parsedQuery.chapter !== null &&
            bibleState.chapters.length > 0
        ) {
            const chapterStr = parsedQuery.chapter.toString();
            const targetChapter = bibleState.chapters.find(
                (c) => c.number === chapterStr,
            );
            if (
                targetChapter &&
                bibleState.selectedChapter !== targetChapter.id
            ) {
                bibleState.selectChapter(targetChapter.id);
            }
        }
    });

    $effect(() => {
        if (
            !bibleState.isLoading &&
            bibleState.verses.length > 0 &&
            parsedQuery.verse !== null &&
            parsedQuery.verse !== lastScrolledVerse
        ) {
            lastScrolledVerse = parsedQuery.verse;
            bibleState.pendingScrollVerse = parsedQuery.verse.toString();
        } else if (parsedQuery.verse === null) {
            lastScrolledVerse = null;
        }
    });

    $effect(() => {
        if (
            bibleState.pendingScrollVerse !== null &&
            !bibleState.isLoading &&
            bibleState.verses.length > 0
        ) {
            const vNum = bibleState.pendingScrollVerse;
            const targetVerse = bibleState.verses.find((v) =>
                v.reference.endsWith(`:${vNum}`),
            );

            if (targetVerse) {
                setTimeout(() => {
                    const el = document.getElementById(
                        `verse-node-${targetVerse.id}`,
                    );
                    if (el) {
                        el.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                        });
                        hoveredVerseId = targetVerse.id;
                    }
                }, 50);
            }
            bibleState.pendingScrollVerse = null;
        }
    });

    function handleSmartInputKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            searchInput?.blur();
            return;
        }

        if (e.key === " " || e.key === ":") {
            const exactMatch = filteredBooks.find(
                (b) => b.name?.toLowerCase() === parsedQuery.book,
            );
            if (parsedQuery.chapter === null) {
                if (exactMatch) {
                    e.preventDefault();
                    smartQuery = exactMatch.name + " ";
                    return;
                } else if (filteredBooks.length === 1) {
                    e.preventDefault();
                    smartQuery = filteredBooks[0].name + " ";
                    return;
                }
            }

            if (parsedQuery.chapter !== null && parsedQuery.verse === null) {
                if (!smartQuery.endsWith(":") && !smartQuery.endsWith(" ")) {
                    e.preventDefault();
                    smartQuery = smartQuery.trim() + ":";
                }
            }
        } else if (e.key === "Enter") {
            const exactVersion = enabledVersions.find(
                (v) =>
                    v.abbreviation?.toLowerCase() ===
                    smartQuery.trim().toLowerCase(),
            );
            if (exactVersion && parsedQuery.chapter === null) {
                e.preventDefault();
                bibleState.switchBibleVersionLive(exactVersion.id);
                smartQuery = "";
                return;
            }

            // Normal Enter to fire Verse
            if (parsedQuery.verse !== null && searchResults.length === 0) {
                e.preventDefault();
                const targetVerse = bibleState.verses.find((v) =>
                    v.reference.endsWith(`:${parsedQuery.verse}`),
                );
                if (targetVerse) sendVerseToProjector(targetVerse);
            }
        }
    }

    async function sendVerseToProjector(verse: any) {
        try {
            const cue = await bibleState.generateChapterCue(verse.id);
            // Fire the cue, targeting the specific verse's first slide
            presentation.fire(cue, `verse_${verse.id}`, `slide_${verse.id}_0`);
            goto("/operator");
        } catch (e) {
            console.error("Failed to generate Bible cue:", e);
        }
    }

    async function sendSearchResultToProjector(result: FtsSearchResult) {
        // 1. Parse the reference (e.g. "John 3:16" or "1 John 2:4")
        const regex = /^(\d?\s*[a-zA-Z]+(?:[\s-]*[a-zA-Z]+)*)\s+(\d+):(\d+)$/i;
        const match = result.reference.match(regex);
        if (!match) return;

        const bookQuery = match[1].trim().toLowerCase();
        const chapterNum = match[2];
        const verseNum = match[3];

        // 2. Navigate bibleState to that exact chapter silently
        const matchedBooks = bibleState.books.filter((b) =>
            b.name.toLowerCase().includes(bookQuery),
        );
        const book =
            matchedBooks.find((b) => b.name.toLowerCase() === bookQuery) ||
            matchedBooks[0];

        if (book) {
            await bibleState.selectBook(book.id);
            const targetChapter = bibleState.chapters.find(
                (c) => c.number === chapterNum,
            );

            if (targetChapter) {
                await bibleState.selectChapter(targetChapter.id);

                // 3. Find the exact verse ID in the CURRENTLY SELECTED translation
                const targetVerse = bibleState.verses.find((v) =>
                    v.reference.endsWith(`:${verseNum}`),
                );

                if (targetVerse) {
                    // This uses `generateChapterCue` which will automatically fetch from YouVersion
                    // if the text is null, ensuring the screen gets the active translation!
                    await sendVerseToProjector(targetVerse);
                }
            }
        }
    }
</script>

<svelte:window
    onshortcut-verse-jump={(e) => {
        e.preventDefault();
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }}
    onshortcut-escape={() => {
        if (document.activeElement === searchInput) searchInput.blur();
    }}
/>

<div class="flex-1 flex min-h-0 bg-zinc-950">
    <!-- LEFT PANE: Navigation -->
    <div
        class="w-1/3 max-w-sm flex flex-col border-r border-zinc-800 bg-zinc-950/50 relative"
    >
        {#if bibleState.isLoading && !bibleState.selectedVersion}
            <div
                class="absolute inset-0 bg-zinc-950/80 z-10 flex items-center justify-center"
            >
                <Loader2 size={24} class="text-violet-500 animate-spin" />
            </div>
        {/if}

        <div class="p-4 flex flex-col gap-4 h-full min-h-0">
            <!-- Translation Selector (Unchanged) -->
            <div class="relative z-50">
                <label
                    for="transalation-selector"
                    class="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider"
                >
                    Translation
                </label>
                <button
                    id="transalation-selector"
                    type="button"
                    onclick={() => (isTranslationOpen = !isTranslationOpen)}
                    class="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 hover:border-violet-600 transition-colors outline-none cursor-pointer"
                >
                    <span class="truncate font-medium">
                        {#if bibleState.selectedVersion}
                            {enabledVersions.find(
                                (v) => v.id === bibleState.selectedVersion,
                            )?.abbreviation ||
                                enabledVersions.find(
                                    (v) => v.id === bibleState.selectedVersion,
                                )?.name}
                        {:else}
                            <span class="text-zinc-500"
                                >Select Translation...</span
                            >
                        {/if}
                    </span>
                    <ChevronDown
                        size={16}
                        class="text-zinc-500 transition-transform duration-200 {isTranslationOpen
                            ? 'rotate-180'
                            : ''}"
                    />
                </button>

                {#if isTranslationOpen}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="fixed inset-0 z-40"
                        onclick={() => (isTranslationOpen = false)}
                    ></div>
                    <div
                        class="absolute top-full left-0 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar flex flex-col py-1"
                    >
                        {#each enabledVersions as version}
                            <button
                                type="button"
                                onclick={() => {
                                    bibleState.switchBibleVersionLive(
                                        version.id,
                                    );
                                    isTranslationOpen = false;
                                }}
                                class="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-zinc-800"
                            >
                                {version.abbreviation || version.name}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Unified Search Bar -->
            <div class="relative">
                <Search
                    size={16}
                    class="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500"
                />
                <input
                    bind:this={searchInput}
                    type="text"
                    placeholder="Search nav (Rev 3 16) or text ('passed away')"
                    bind:value={smartQuery}
                    onkeydown={handleSmartInputKeydown}
                    disabled={!bibleState.selectedVersion}
                    class="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors outline-none disabled:opacity-50"
                />
            </div>

            <!-- Books/Chapters layout (Only visible if NOT searching text) -->
            <div
                class="flex-1 flex gap-2 min-h-0 overflow-hidden relative"
                class:opacity-30={searchResults.length > 0 || isSearching}
            >
                {#if bibleState.isLoading && bibleState.selectedVersion && !bibleState.selectedChapter && !isSearching}
                    <div
                        class="absolute inset-0 bg-zinc-950/70 z-10 flex items-center justify-center backdrop-blur-sm rounded-lg"
                    >
                        <Loader2
                            size={32}
                            class="text-violet-500 animate-spin"
                        />
                    </div>
                {/if}
                <div class="w-3/5 flex flex-col">
                    <label
                        for="books"
                        class="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider"
                        >Book</label
                    >
                    <div
                        id="books"
                        class="overflow-y-auto flex-1 space-y-0.5 pr-1 custom-scrollbar"
                    >
                        {#each filteredBooks as book (book.id)}
                            <button
                                onclick={() => bibleState.selectBook(book.id)}
                                class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors {bibleState.selectedBook ===
                                book.id
                                    ? 'bg-violet-600/20 text-violet-400 font-medium border border-violet-500/30'
                                    : 'text-zinc-300 hover:bg-zinc-800/80 border border-transparent'}"
                            >
                                {book.name}
                            </button>
                        {/each}
                    </div>
                </div>

                <div
                    class="w-2/5 flex flex-col border-l border-zinc-800/50 pl-2"
                >
                    <label
                        for="chapters"
                        class="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider"
                        >Ch</label
                    >
                    <div
                        id="chapters"
                        class="overflow-y-auto flex-1 custom-scrollbar"
                    >
                        {#if bibleState.chapters.length > 0}
                            <div
                                class="grid grid-cols-2 gap-1 content-start pr-1"
                            >
                                {#each bibleState.chapters as chapter (chapter.id)}
                                    {#if chapter.number !== "intro"}
                                        <button
                                            onclick={() =>
                                                bibleState.selectChapter(
                                                    chapter.id,
                                                )}
                                            class="px-2 py-1.5 rounded-md text-sm font-medium transition-colors {bibleState.selectedChapter ===
                                            chapter.id
                                                ? 'bg-violet-600 text-white shadow-md shadow-violet-900/20'
                                                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-800'}"
                                        >
                                            {chapter.number}
                                        </button>
                                    {/if}
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- RIGHT PANE: Verses & Search Results -->
    <div class="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
        {#if (bibleState.isLoading && bibleState.selectedChapter) || isSearching}
            <div
                class="absolute inset-0 bg-zinc-950/50 z-10 flex items-center justify-center"
            >
                <Loader2 size={32} class="text-violet-500 animate-spin" />
            </div>
        {/if}

        {#if searchResults.length > 0 || (smartQuery.length > 2 && filteredBooks.length === 0)}
            <!-- SEARCH RESULTS VIEW -->
            <div
                class="px-6 py-4 border-b border-zinc-800 bg-zinc-950/80 sticky top-0 z-10 backdrop-blur-sm flex justify-between items-end"
            >
                <div>
                    <h2 class="text-2xl font-bold text-zinc-100 tracking-tight">
                        Search Results
                    </h2>
                    <p class="text-sm text-violet-400 font-medium mt-1">
                        "{smartQuery}"
                    </p>
                </div>
                <div
                    class="text-xs text-zinc-500 font-medium bg-zinc-900 px-2 py-1 rounded-md"
                >
                    {searchResults.length} results
                </div>
            </div>

            <div
                class="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar"
            >
                {#if searchResults.length === 0 && !isSearching}
                    <div
                        class="flex flex-col items-center justify-center h-full text-zinc-500 gap-2 mt-10"
                    >
                        <Search size={32} class="opacity-20" />
                        <p>No verses found for "{smartQuery}"</p>
                    </div>
                {:else}
                    {#each searchResults as result}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <div
                            onmouseenter={() =>
                                (hoveredVerseId = result.reference)}
                            onmouseleave={() => (hoveredVerseId = null)}
                            ondblclick={() =>
                                sendSearchResultToProjector(result)}
                            class="group relative w-full text-left pl-6 pr-16 py-4 rounded-xl border transition-all duration-200 cursor-pointer {hoveredVerseId ===
                            result.reference
                                ? 'bg-violet-900/10 border-violet-500/30 shadow-sm'
                                : 'bg-zinc-900/30 border-zinc-800/30 hover:bg-zinc-900/60'}"
                        >
                            <div class="text-violet-400 font-bold mb-1">
                                {result.reference}
                            </div>
                            <!-- Render the HTML so the Rust <mark> tags work -->
                            <div
                                class="text-zinc-200 text-lg leading-relaxed font-medium"
                            >
                                {@html result.text}
                            </div>

                            {#if hoveredVerseId === result.reference}
                                <div
                                    class="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2"
                                >
                                    <button
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            sendSearchResultToProjector(result);
                                        }}
                                        class="p-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white shadow-lg transition-all scale-95 hover:scale-100 flex items-center gap-2"
                                        title="Send Live"
                                    >
                                        <Play size={16} class="fill-current" />
                                        <span
                                            class="text-xs font-bold uppercase tracking-wider pr-1"
                                            >Live</span
                                        >
                                    </button>
                                </div>
                            {/if}
                        </div>
                    {/each}
                {/if}
            </div>
        {:else if bibleState.verses.length > 0}
            <!-- NORMAL CHAPTER VERSES VIEW -->
            <div
                class="px-6 py-4 border-b border-zinc-800 bg-zinc-950/80 sticky top-0 z-10 backdrop-blur-sm flex justify-between items-end"
            >
                <div>
                    <h2 class="text-2xl font-bold text-zinc-100 tracking-tight">
                        {bibleState.books.find(
                            (b) => b.id === bibleState.selectedBook,
                        )?.name}
                        {bibleState.chapters.find(
                            (c) => c.id === bibleState.selectedChapter,
                        )?.number}
                    </h2>
                    <p class="text-sm text-violet-400 font-medium mt-1">
                        {bibleState.versions.find(
                            (v) => v.id === bibleState.selectedVersion,
                        )?.abbreviation}
                    </p>
                </div>
                <div
                    class="text-xs text-zinc-500 font-medium bg-zinc-900 px-2 py-1 rounded-md"
                >
                    {bibleState.verses.length} verses
                </div>
            </div>

            <div
                class="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar"
            >
                {#each bibleState.verses as verse (verse.id)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        id="verse-node-{verse.id}"
                        use:lazyLoadVerse={verse.id}
                        onmouseenter={() => {
                            hoveredVerseId = verse.id;
                            if (
                                verse.text === null &&
                                !fetchingVerses.has(verse.id)
                            ) {
                                fetchingVerses.add(verse.id);
                                bibleState
                                    .resolveVerseText(verse.id)
                                    .finally(() =>
                                        fetchingVerses.delete(verse.id),
                                    );
                            }
                        }}
                        onmouseleave={() => (hoveredVerseId = null)}
                        ondblclick={() => sendVerseToProjector(verse)}
                        class="group relative w-full text-left pl-12 pr-16 py-3 rounded-xl border transition-all duration-200 cursor-pointer {hoveredVerseId ===
                        verse.id
                            ? 'bg-violet-900/10 border-violet-500/30 shadow-sm'
                            : 'bg-zinc-900/30 border-zinc-800/30 hover:bg-zinc-900/60'}"
                    >
                        <span
                            class="absolute left-4 top-3.5 text-zinc-500 text-sm font-mono font-bold w-6 text-right"
                        >
                            {verse.reference.split(":").pop()}
                        </span>

                        <p
                            class="text-zinc-200 text-lg leading-relaxed font-medium"
                        >
                            {#if verse.text}
                                {verse.text}
                            {:else}
                                <span class="animate-pulse text-zinc-600"
                                    >Loading text...</span
                                >
                            {/if}
                        </p>

                        {#if hoveredVerseId === verse.id}
                            <div
                                class="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2"
                            >
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        sendVerseToProjector(verse);
                                    }}
                                    class="p-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white shadow-lg transition-all scale-95 hover:scale-100 flex items-center gap-2"
                                >
                                    <Play size={16} class="fill-current" />
                                    <span
                                        class="text-xs font-bold uppercase tracking-wider pr-1"
                                        >Live</span
                                    >
                                </button>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <!-- EMPTY STATE -->
            <div
                class="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4"
            >
                <BookOpen size={48} class="opacity-20" />
                <p class="text-lg font-medium">
                    Select a chapter or search for a verse
                </p>
            </div>
        {/if}
    </div>
</div>
