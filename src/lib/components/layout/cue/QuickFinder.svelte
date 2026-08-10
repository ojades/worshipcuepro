<!-- src/lib/components/layout/cue/QuickFinder.svelte -->
<script lang="ts">
    import {
        Search,
        Music,
        BookOpen,
        Image as ImageIcon,
        Play,
        Command,
    } from "@lucide/svelte";
    import { onMount, onDestroy } from "svelte";
    import { songsState } from "$lib/state/songs.svelte";
    import { bibleState } from "$lib/state/bible.svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { media } from "$lib/state/media.svelte";
    import { goto } from "$app/navigation";
    import { playlists } from "$lib/state/playlists.svelte";
    import { convertFileSrc } from "@tauri-apps/api/core";
    import { formatShortcut, SHORTCUTS } from "$lib/utils/shortcuts";
    import { settingsState } from "$lib/state/settings.svelte";
    import { chunkProse, switchBibleVersionLive } from "$lib/utils/helper";
    import type { FtsSearchResult } from "$lib/commands/bible-db";
    import type { SongSearchResult } from "$lib/commands/song-db"; // NEW: Import Song FTS Type

    // UX State
    let searchQuery = $state("");
    let activeTab = $state<"all" | "songs" | "bible" | "media">("all");
    let searchInput: HTMLInputElement;
    let selectedIndex = $state(0);

    // Asynchronous state for FTS search
    let isSearchingBible = $state(false);
    let isSearchingSongs = $state(false); // NEW: Song loading state
    let bibleFtsResults = $state<FtsSearchResult[]>([]);
    let songFtsResults = $state<SongSearchResult[]>([]); // NEW: Song FTS results
    let searchTimeout: ReturnType<typeof setTimeout>;

    const tabs = [
        { id: "all", label: "All" },
        { id: "songs", label: "Songs", icon: Music },
        { id: "bible", label: "Bible", icon: BookOpen },
        { id: "media", label: "Media", icon: ImageIcon },
    ] as const;

    let enabledVersions = $derived.by(() => {
        const enabledIds = (settingsState.config as any).enabledBibles || [];
        if (enabledIds.length === 0) return bibleState.versions;
        return bibleState.versions.filter((v) => enabledIds.includes(v.id));
    });

    // Auto-detect Version Abbreviations in the Quick Finder
    $effect(() => {
        const parts = searchQuery.trimStart().split(" ");
        if (parts.length > 1) {
            const firstWord = parts[0].toLowerCase();
            const matchedVersion = enabledVersions.find(
                (v) => v.abbreviation?.toLowerCase() === firstWord,
            );

            if (matchedVersion) {
                if (bibleState.selectedVersion !== matchedVersion.id) {
                    switchBibleVersionLive(matchedVersion.id);
                }
                searchQuery = searchQuery
                    .substring(firstWord.length)
                    .trimStart();
            }
        }
    });

    // --- NEW: Concurrent Async FTS Search for Bible & Songs ---
    $effect(() => {
        const query = searchQuery.toLowerCase().trim();
        const regex =
            /^(\d?\s*[a-z]+(?:[\s-]*[a-z]+)*)\s*(?:(\d+)\s*(?:[:\s]\s*(\d+))?)?$/i;
        const match = query.match(regex);

        // Does it look like a Bible navigation reference?
        const isBibleNav =
            match &&
            bibleState.books.some(
                (b) => b.name.toLowerCase() === match[1]?.trim(),
            );

        if (query.length > 2) {
            clearTimeout(searchTimeout);

            // Set loading indicators
            if (!isBibleNav && (activeTab === "all" || activeTab === "bible"))
                isSearchingBible = true;
            if (activeTab === "all" || activeTab === "songs")
                isSearchingSongs = true;

            searchTimeout = setTimeout(async () => {
                const promises = [];

                // 1. Search Bible
                if (
                    !isBibleNav &&
                    (activeTab === "all" || activeTab === "bible")
                ) {
                    promises.push(
                        bibleState
                            .search(query, 10)
                            .then((res) => (bibleFtsResults = res)),
                    );
                } else {
                    bibleFtsResults = [];
                }

                // 2. Search Songs
                if (activeTab === "all" || activeTab === "songs") {
                    promises.push(
                        songsState
                            .search(query, 10)
                            .then((res) => (songFtsResults = res)),
                    );
                } else {
                    songFtsResults = [];
                }

                await Promise.all(promises);
                isSearchingBible = false;
                isSearchingSongs = false;
            }, 150);
        } else {
            bibleFtsResults = [];
            songFtsResults = [];
            isSearchingBible = false;
            isSearchingSongs = false;
        }
    });

    // Derived Search Results (Sync + Async merged)
    let searchResults = $derived.by(() => {
        if (!searchQuery.trim()) return [];

        const query = searchQuery.toLowerCase();
        let results: any[] = [];

        // 0. Detect pure Version Abbreviation Switch (e.g. just typing "KJV")
        if (activeTab === "all" || activeTab === "bible") {
            const exactVersion = enabledVersions.find(
                (v) => v.abbreviation?.toLowerCase() === query.trim(),
            );
            if (exactVersion) {
                results.push({
                    id: `version_${exactVersion.id}`,
                    type: "version_switch",
                    title: `Switch Translation to ${exactVersion.abbreviation}`,
                    subtitle: exactVersion.name,
                    payload: exactVersion,
                });
            }
        }

        // 1. Search Songs (Using Blazing Fast FTS)
        if (activeTab === "all" || activeTab === "songs") {
            const formattedSongs = songFtsResults.map((s) => ({
                id: `song_${s.id}`,
                type: "song",
                title: s.title,
                // If snippet exists, show the HTML highlight. Otherwise default to Artist.
                subtitle: s.lyrics_snippet || s.artist || "Unknown Artist",
                isHtml: !!s.lyrics_snippet,
                payload: s,
            }));
            results.push(...formattedSongs);
        }

        // 2. Search Bible
        if (activeTab === "all" || activeTab === "bible") {
            const regex =
                /^(\d?\s*[a-z]+(?:[\s-]*[a-z]+)*)\s*(?:(\d+)\s*(?:[:\s]\s*(\d+))?)?$/i;
            const match = query.match(regex);

            // A. Reference Navigation (e.g., "John 3 16")
            if (match) {
                const bookQuery = match[1]?.trim().toLowerCase();
                const matchedBooks = bibleState.books.filter((b) =>
                    b.name.toLowerCase().includes(bookQuery),
                );
                const exactMatch = matchedBooks.find(
                    (b) => b.name.toLowerCase() === bookQuery,
                );
                const book =
                    exactMatch ||
                    (matchedBooks.length === 1 ? matchedBooks[0] : null);

                if (book) {
                    const chapter = match[2] ? ` ${match[2]}` : "";
                    const verse = match[3] ? `:${match[3]}` : "";

                    results.push({
                        id: `bible_${book.id}`,
                        type: "bible_nav",
                        title: `${book.name}${chapter}${verse}`,
                        subtitle: "Press Enter to open Reference",
                        payload: {
                            bookId: book.id,
                            chapterNum: match[2],
                            verseNum: match[3],
                        },
                    });
                }
            }

            // B. FTS Phrase Results (e.g., "passed away")
            const ftsFormatted = bibleFtsResults.map((res) => ({
                id: `bible_fts_${res.reference}`,
                type: "bible_fts",
                title: res.reference,
                subtitle: res.text,
                isHtml: true,
                payload: res,
            }));

            results.push(...ftsFormatted);
        }

        // 3. Search Media
        if (activeTab === "all" || activeTab === "media") {
            const matchedMedia = media.allMedia
                .filter((m) => m.filename.toLowerCase().includes(query))
                .map((m) => ({
                    id: `media_${m.id}`,
                    type: "media",
                    title: m.filename,
                    subtitle:
                        m.type === "video"
                            ? "Video Background"
                            : "Image Background",
                    payload: m,
                }));
            results.push(...matchedMedia);
        }

        return results;
    });

    $effect(() => {
        if (searchResults.length) {
            selectedIndex = 0;
        }
    });

    onMount(() => {
        const handleFocus = () => searchInput?.focus();
        const handleEscape = () => {
            if (searchQuery || document.activeElement === searchInput) {
                searchQuery = "";
                searchInput?.blur();
            }
        };

        window.addEventListener("shortcut-quick-finder", handleFocus);
        window.addEventListener("shortcut-escape", handleEscape);

        return () => {
            window.removeEventListener("shortcut-quick-finder", handleFocus);
            window.removeEventListener("shortcut-escape", handleEscape);
        };
    });

    function handleInputKeydown(e: KeyboardEvent) {
        if (searchResults.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % searchResults.length;
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                selectedIndex =
                    (selectedIndex - 1 + searchResults.length) %
                    searchResults.length;
            } else if (e.key === "Enter") {
                e.preventDefault();
                fireResult(searchResults[selectedIndex]);
            }
        }
    }

    async function fireResult(result: any) {
        if (result.type === "song") {
            await playlists.addCueToActive(result.payload.id, "song");
            const newCue = presentation.activePlaylist?.cues.at(-1);
            if (newCue) presentation.fire(newCue);
        } else if (result.type === "version_switch") {
            switchBibleVersionLive(result.payload.id);
        } else if (result.type === "bible_nav") {
            const { bookId, chapterNum, verseNum } = result.payload;
            goto("/operator/bibles");
            if (chapterNum) {
                bibleState.goToReference(bookId, chapterNum, verseNum);
            } else {
                bibleState.selectBook(bookId);
            }
        } else if (result.type === "bible_fts") {
            const ftsItem = result.payload as FtsSearchResult;
            const version = bibleState.versions.find(
                (v) => v.id === bibleState.selectedVersion,
            );
            const versionAbbr =
                version?.abbreviation || version?.name || "Bible";
            const linesPerSlide =
                (settingsState.config as any).linesPerSlide || 0;
            const currentFontScale =
                settingsState.config.projector?.textScale ?? 1.0;

            const bibleCue = {
                id: `bible_search_${Date.now()}`,
                type: "bible",
                title: ftsItem.reference,
                artist: versionAbbr,
                sections: [
                    {
                        id: `sec_search`,
                        title: ftsItem.reference,
                        slides: chunkProse(
                            ftsItem.full_text,
                            linesPerSlide,
                            currentFontScale,
                        ).map((chunkText, i, arr) => ({
                            id: `slide_${i}`,
                            text: chunkText,
                            reference: `${ftsItem.reference} (${versionAbbr})${arr.length > 1 ? ` [${i + 1}/${arr.length}]` : ""}`,
                        })),
                    },
                ],
            };

            presentation.fire(bibleCue, `slide_0`);
            await playlists.ensureActivePlaylist();
            goto("/operator");
        } else if (result.type === "media") {
            const mediaItem = result.payload;
            const safeUrl =
                mediaItem.asset_url ||
                (mediaItem.filepath ? convertFileSrc(mediaItem.filepath) : "");
            if (safeUrl) presentation.setBackground(safeUrl, mediaItem.type);
        }

        searchQuery = "";
        searchInput.blur();
    }
</script>

<div
    class="flex flex-col h-full bg-card/30 rounded-xl border border-border shadow-inner overflow-hidden"
>
    <!-- Header: Search Bar & Tabs -->
    <div class="p-3 border-b border-border bg-background/50 space-y-3 shrink-0">
        <!-- Omni-Search Input -->
        <div class="relative group">
            <Search
                size={18}
                class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-neon-violet transition-colors"
            />
            <input
                bind:this={searchInput}
                bind:value={searchQuery}
                onkeydown={handleInputKeydown}
                type="text"
                placeholder="Search songs, lyrics, scripture, or media..."
                class="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-16 py-2.5 text-sm text-foreground placeholder-zinc-500 focus:border-neon-violet focus:ring-1 focus:ring-neon-violet outline-none transition-all"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                autocorrect="off"
            />
            <div
                class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-[10px] text-zinc-500 font-bold bg-zinc-800 px-1.5 py-0.5 rounded"
            >
                {formatShortcut(SHORTCUTS.QUICK_FINDER)}
            </div>
        </div>

        <!-- Filter Tabs -->
        <div class="flex items-center gap-1">
            {#each tabs as tab}
                <button
                    onclick={() => {
                        activeTab = tab.id;
                        searchInput?.focus();
                    }}
                    class="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 {activeTab ===
                    tab.id
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}"
                >
                    {#if tab.icon}<tab.icon size={14} />{/if}
                    {tab.label}
                </button>
            {/each}
        </div>
    </div>

    <!-- Results Area -->
    <div class="flex-1 overflow-y-auto p-2 custom-scrollbar relative">
        {#if !searchQuery}
            <div
                class="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-60 pointer-events-none"
            >
                <Search size={32} class="mb-3 opacity-20" />
                <p class="text-sm font-medium">Quick Finder</p>
                <p class="text-xs mt-1">
                    Type anywhere and press <kbd
                        class="px-1 py-0.5 bg-zinc-800 rounded">Enter</kbd
                    > to fire
                </p>
            </div>
        {:else if isSearchingBible || isSearchingSongs}
            <div
                class="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm"
            >
                <span class="animate-pulse">Searching...</span>
            </div>
        {:else if searchResults.length === 0}
            <div
                class="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm"
            >
                No results found for "{searchQuery}"
            </div>
        {:else}
            <div class="space-y-1">
                {#each searchResults as result, i}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        onmouseenter={() => (selectedIndex = i)}
                        onclick={() => fireResult(result)}
                        class="group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border {selectedIndex ===
                        i
                            ? 'bg-neon-violet/10 border-neon-violet/30'
                            : 'bg-transparent border-transparent hover:bg-zinc-800/50'}"
                    >
                        <div
                            class="flex items-center gap-3 overflow-hidden w-full"
                        >
                            <!-- Type Icon / Thumbnail Container -->
                            {const safeUrl =
                                result.type === "media"
                                    ? result.payload.asset_url ||
                                      (result.payload.filepath
                                          ? convertFileSrc(
                                                result.payload.filepath,
                                            )
                                          : "")
                                    : ""}

                            <div
                                class="shrink-0 w-12 aspect-video rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 overflow-hidden flex items-center justify-center transition-colors {selectedIndex ===
                                i
                                    ? 'text-neon-violet border-neon-violet/30'
                                    : ''}"
                            >
                                {#if result.type === "media" && safeUrl}
                                    {#if result.payload.type === "video"}
                                        <video
                                            src="{safeUrl}#t=0.1"
                                            class="w-full h-full object-cover"
                                            preload="metadata"
                                            muted
                                        ></video>
                                    {:else}
                                        <img
                                            src={safeUrl}
                                            alt={result.title}
                                            class="w-full h-full object-cover"
                                        />
                                    {/if}
                                {:else if result.type === "song"}
                                    <Music size={14} />
                                {:else if result.type === "bible_nav" || result.type === "bible_fts" || result.type === "version_switch"}
                                    <BookOpen size={14} />
                                {:else}
                                    <ImageIcon size={14} />
                                {/if}
                            </div>

                            <!-- Text Details -->
                            <div class="flex flex-col truncate flex-1">
                                <span
                                    class="text-sm font-semibold text-zinc-200 truncate {result.type ===
                                    'bible_fts'
                                        ? 'text-violet-400'
                                        : ''}"
                                >
                                    {result.title}
                                </span>
                                {#if result.isHtml}
                                    <!-- Renders HTML for Bible AND Song FTS highlights -->
                                    <span class="text-xs text-zinc-400 truncate"
                                        >{@html result.subtitle}</span
                                    >
                                {:else}
                                    <span
                                        class="text-xs text-zinc-500 truncate {result.subtitle ===
                                        'Matches in lyrics'
                                            ? 'italic'
                                            : ''}"
                                    >
                                        {result.subtitle}
                                    </span>
                                {/if}
                            </div>
                        </div>

                        <!-- Action Indicator -->
                        {#if selectedIndex === i}
                            <button
                                class="shrink-0 px-3 py-1 bg-neon-violet text-white text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1 shadow-lg shadow-neon-violet/20 animate-in fade-in slide-in-from-right-2"
                            >
                                <Play size={10} class="fill-current" />
                                {result.type === "version_switch"
                                    ? "Apply"
                                    : "Fire"}
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
