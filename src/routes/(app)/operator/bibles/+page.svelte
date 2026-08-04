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

    // Local UI State
    let smartQuery = $state("");
    let hoveredVerseId = $state<string | null>(null);
    let isTranslationOpen = $state(false);
    let pendingVerseToFire = $state<number | null>(null); // For lag handling
    const fetchingVerses = new Set<string>();

    // Load versions when the page mounts
    onMount(() => {
        if (bibleState.versions.length === 0) {
            bibleState.loadVersions();
        }
    });

    // 1. Filter versions based on settings state
    let enabledVersions = $derived.by(() => {
        const enabledIds = (settingsState.config as any).enabledBibles || [];
        if (enabledIds.length === 0) return bibleState.versions;
        return bibleState.versions.filter((v) => enabledIds.includes(v.id));
    });

    // 2. Parse the query intelligently (e.g. "rev 3 16" -> Book: rev, Ch: 3, V: 16)
    let parsedQuery = $derived.by(() => {
        const q = smartQuery.trimStart().toLowerCase();
        // Regex matches: [Optional Number] [Book Text] [Space] [Chapter Number] [Space or Colon] [Verse Number]
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

    function lazyLoadVerse(node: HTMLElement, verseId: string) {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    const verse = bibleState.verses.find(
                        (v) => v.id === verseId,
                    );
                    // Only fetch if it's explicitly null (not loaded yet) and not already fetching
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

    // 3. Sync State: Auto-select Book
    $effect(() => {
        if (parsedQuery.book && filteredBooks.length === 1) {
            const targetBook = filteredBooks[0];
            if (bibleState.selectedBook !== targetBook.id) {
                bibleState.selectBook(targetBook.id);
            }
        }
    });

    // 4. Sync State: Auto-select Chapter
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

    // Scroll to verse when it becomes available
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
                // Slight delay to ensure DOM nodes are fully rendered
                setTimeout(() => {
                    const el = document.getElementById(
                        `verse-node-${targetVerse.id}`,
                    );
                    if (el) {
                        el.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                        });
                        // Highlight the verse automatically for preview
                        hoveredVerseId = targetVerse.id;
                    }
                }, 50);
            }
            // Clear pending regardless of success so we don't get stuck
            bibleState.pendingScrollVerse = null;
        }
    });

    // 6. Keyboard Interactions
    function handleSmartInputKeydown(e: KeyboardEvent) {
        if (e.key === " ") {
            // Hit space to complete the book name
            if (filteredBooks.length === 1 && parsedQuery.chapter === null) {
                e.preventDefault();
                smartQuery = filteredBooks[0].name + " ";
            }
        } else if (e.key === "Enter") {
            // Hit enter to flag the verse to be fired
            if (parsedQuery.verse !== null) {
                e.preventDefault();
                pendingVerseToFire = parsedQuery.verse;
            }
        }
    }

    async function sendVerseToProjector(verse: any) {
        if (
            !bibleState.selectedVersion ||
            !bibleState.selectedBook ||
            !bibleState.selectedChapter
        )
            return;

        // Force resolve if the operator clicked it before the observer caught it
        if (!verse.text) {
            await bibleState.resolveVerseText(verse.id);
            // Re-fetch the verse from state to get the newly populated text
            verse = bibleState.verses.find((v) => v.id === verse.id) || verse;
        }

        const version = bibleState.versions.find(
            (v) => v.id === bibleState.selectedVersion,
        );
        const versionAbbr = version?.abbreviation || version?.name || "Bible";
        const book = bibleState.books.find(
            (b) => b.id === bibleState.selectedBook,
        );
        const chapter = bibleState.chapters.find(
            (c) => c.id === bibleState.selectedChapter,
        );
        const linesPerSlide = (settingsState.config as any).linesPerSlide || 0;

        const bibleCue = {
            id: `bible_${bibleState.selectedVersion}_${bibleState.selectedChapter}`,
            type: "bible",
            title: `${book?.name} ${chapter?.number}`,
            artist: versionAbbr,
            sections: bibleState.verses.map((v) => {
                // v.text will be null for verses out of view. Pass the fallback string to chunkProse.
                const chunks = chunkProse(
                    v.text || "Loading...",
                    linesPerSlide,
                );
                return {
                    id: `verse_${v.id}`,
                    title: v.reference,
                    slides: chunks.map((chunkText, i) => ({
                        id: `slide_${v.id}_${i}`,
                        text: chunkText,
                        reference: `${v.reference} (${versionAbbr})${chunks.length > 1 ? ` [${i + 1}/${chunks.length}]` : ""}`,
                    })),
                };
            }),
        };

        presentation.fire(bibleCue, `verse_${verse.id}`);
        goto("/operator");
    }
</script>

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
            <!-- Translation Selector -->
            <div class="relative z-50">
                <label
                    for="transalation-selector"
                    class="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider"
                >
                    Translation
                </label>

                <button
                    id="transalation-selector"
                    type="button"
                    onclick={() => (isTranslationOpen = !isTranslationOpen)}
                    class="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors outline-none cursor-pointer"
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

                <!-- Custom Dropdown Menu -->
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
                                    bibleState.selectVersion(version.id);
                                    isTranslationOpen = false;
                                }}
                                class="w-full text-left px-4 py-2.5 text-sm transition-colors {bibleState.selectedVersion ===
                                version.id
                                    ? 'bg-violet-600/20 text-violet-400 font-medium'
                                    : 'text-zinc-300 hover:bg-zinc-800'}"
                            >
                                {version.abbreviation || version.name}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Fast Book Search -->
            <div class="relative">
                <Search
                    size={16}
                    class="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500"
                />
                <input
                    type="text"
                    placeholder="Search (e.g. 'rev 3 16')"
                    bind:value={smartQuery}
                    onkeydown={handleSmartInputKeydown}
                    disabled={!bibleState.selectedVersion}
                    class="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors outline-none disabled:opacity-50"
                />
            </div>

            <!-- Two-pane internal layout for Books and Chapters -->
            <div class="flex-1 flex gap-2 min-h-0 overflow-hidden relative">
                {#if bibleState.isLoading && bibleState.selectedVersion && !bibleState.selectedChapter}
                    <div
                        class="absolute inset-0 bg-zinc-950/70 z-10 flex items-center justify-center backdrop-blur-sm rounded-lg"
                    >
                        <Loader2
                            size={32}
                            class="text-violet-500 animate-spin"
                        />
                    </div>
                {/if}
                <!-- Books List -->
                <div class="w-3/5 flex flex-col">
                    <label
                        for="bible-book"
                        class="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider"
                    >
                        Book
                    </label>
                    <div
                        id="bible-book"
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

                <!-- Chapter Grid -->
                <div
                    class="w-2/5 flex flex-col border-l border-zinc-800/50 pl-2"
                >
                    <label
                        for="bible-chapters"
                        class="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider"
                    >
                        Ch
                    </label>
                    <div
                        id="bible-chapters"
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
                                                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800'}"
                                        >
                                            {chapter.number}
                                        </button>
                                    {/if}
                                {/each}
                            </div>
                        {:else}
                            <div
                                class="h-full flex items-center justify-center text-zinc-600 text-xs text-center px-2"
                            >
                                Select a book
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- RIGHT PANE: Verses (2/3 width) -->
    <div class="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
        {#if bibleState.isLoading && bibleState.selectedChapter}
            <div
                class="absolute inset-0 bg-zinc-950/50 z-10 flex items-center justify-center"
            >
                <Loader2 size={32} class="text-violet-500 animate-spin" />
            </div>
        {/if}

        {#if bibleState.verses.length > 0}
            <!-- Header -->
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

            <!-- Verse List -->
            <div
                class="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar"
            >
                {#each bibleState.verses as verse (verse.id)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->

                    <!-- NOTE: Added id="verse-node-{verse.id}" for smooth scrolling -->
                    <div
                        id="verse-node-{verse.id}"
                        use:lazyLoadVerse={verse.id}
                        onmouseenter={() => {
                            hoveredVerseId = verse.id;
                            // Backup trigger: If they hover fast and it hasn't loaded, fetch it
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
                            : 'bg-zinc-900/30 border-zinc-800/30 hover:bg-zinc-900/60 hover:border-zinc-700'}"
                    >
                        <span
                            class="absolute left-4 top-3.5 text-zinc-500 text-sm font-mono font-bold w-6 text-right"
                        >
                            {verse.reference.split(":").pop()}
                        </span>

                        <!--  Nicer visual loading state instead of raw text -->
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
            </div>
        {:else}
            <div
                class="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4"
            >
                <BookOpen size={48} class="opacity-20" />
                <p class="text-lg font-medium">
                    Select a chapter to view verses
                </p>
                <p class="text-sm opacity-60">
                    Use the sidebar to navigate the Bible
                </p>
            </div>
        {/if}
    </div>
</div>
