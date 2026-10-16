<!-- src/lib/components/layout/cue/QuickFinder.svelte -->
<script lang="ts">
    import {
        Search,
        Music,
        BookOpen,
        Image as ImageIcon,
        Play,
        ListPlus,
    } from "@lucide/svelte";
    import { onMount, onDestroy } from "svelte";
    import { songsState } from "$lib/state/songs.svelte";
    import { bibleState } from "$lib/state/bible.svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { media } from "$lib/state/media.svelte";
    import { goto } from "$app/navigation";
    import { convertFileSrc } from "@tauri-apps/api/core";
    import { settingsState } from "$lib/state/settings.svelte";
    import { parseLyrics } from "$lib/utils/lyrics";
    import type { FtsSearchResult } from "$lib/commands/bible-db";
    import type { SongSearchResult } from "$lib/commands/song-db";
    import AddToPlaylistMenu from "$lib/components/ui/AddToPlaylistMenu.svelte";

    let isOpen = $state(false);
    let searchQuery = $state("");
    let activeTab = $state<"all" | "songs" | "bible" | "media">("all");
    let searchInput: HTMLInputElement;
    let selectedIndex = $state(0);

    let isSearchingBible = $state(false);
    let isSearchingSongs = $state(false);
    let bibleFtsResults = $state<FtsSearchResult[]>([]);
    let songFtsResults = $state<SongSearchResult[]>([]);
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

    $effect(() => {
        if (!isOpen) return; // Only process if open
        const parts = searchQuery.trimStart().split(" ");
        if (parts.length > 1) {
            const firstWord = parts[0].toLowerCase();
            const matchedVersion = enabledVersions.find(
                (v) => v.abbreviation?.toLowerCase() === firstWord,
            );

            if (matchedVersion) {
                if (bibleState.selectedVersion !== matchedVersion.id) {
                    bibleState.switchBibleVersionLive(matchedVersion.id);
                }
                searchQuery = searchQuery
                    .substring(firstWord.length)
                    .trimStart();
            }
        }
    });

    $effect(() => {
        if (!isOpen) return;
        const query = searchQuery.toLowerCase().trim();
        const regex =
            /^(\d?\s*[a-z]+(?:[\s-]*[a-z]+)*)\s*(?:(\d+)\s*(?:[:\s]\s*(\d+))?)?$/i;
        const match = query.match(regex);

        const isBibleNav =
            match &&
            bibleState.books.some(
                (b) => b.name.toLowerCase() === match[1]?.trim(),
            );

        if (query.length > 2) {
            clearTimeout(searchTimeout);

            if (!isBibleNav && (activeTab === "all" || activeTab === "bible"))
                isSearchingBible = true;
            if (activeTab === "all" || activeTab === "songs")
                isSearchingSongs = true;

            searchTimeout = setTimeout(async () => {
                const promises = [];

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

    let searchResults = $derived.by(() => {
        if (!isOpen || !searchQuery.trim()) return [];

        const query = searchQuery.toLowerCase();
        let results: any[] = [];

        // ... Keep existing exact exact tab matching logic ...
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

        if (activeTab === "all" || activeTab === "songs") {
            const formattedSongs = songFtsResults.map((s) => ({
                id: `song_${s.id}`,
                type: "song",
                title: s.title,
                subtitle: s.lyrics_snippet || s.artist || "Unknown Artist",
                isHtml: !!s.lyrics_snippet,
                payload: s,
            }));
            results.push(...formattedSongs);
        }

        if (activeTab === "all" || activeTab === "bible") {
            const regex =
                /^(\d?\s*[a-z]+(?:[\s-]*[a-z]+)*)\s*(?:(\d+)\s*(?:[:\s]\s*(\d+))?)?$/i;
            const match = query.match(regex);

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

    function closeFinder() {
        isOpen = false;
        searchQuery = "";
        bibleFtsResults = [];
        songFtsResults = [];
        searchInput?.blur();
    }

    onMount(() => {
        const handleFocus = () => {
            isOpen = true;
            setTimeout(() => searchInput?.focus(), 50);
        };

        const handleEscape = () => {
            if (isOpen) closeFinder();
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
        } else if (e.key === "Escape") {
            closeFinder();
        }
    }

    async function fireResult(result: any) {
        if (result.type === "song") {
            const fullSong = songsState.songs.find(
                (s) => s.id === result.payload.id,
            );
            if (fullSong) {
                const cue = {
                    id: fullSong.id,
                    type: "song",
                    title: fullSong.title,
                    raw_lyrics: fullSong.raw_lyrics,
                    lines_per_slide: fullSong.lines_per_slide,
                    sections: parseLyrics(
                        fullSong.raw_lyrics || "",
                        fullSong.lines_per_slide || 0,
                    ),
                };
                presentation.fire(
                    cue,
                    `song_${fullSong.id}`,
                    `slide_${fullSong.id}_0`,
                );
                goto("/operator");
            }
        } else if (result.type === "version_switch") {
            bibleState.switchBibleVersionLive(result.payload.id);
        } else if (result.type === "bible_nav") {
            const { bookId, chapterNum, verseNum } = result.payload;
            if (chapterNum) {
                await bibleState.goToReference(bookId, chapterNum, verseNum);
                if (verseNum) {
                    const targetVerse = bibleState.verses.find((v) =>
                        v.reference.endsWith(`:${verseNum}`),
                    );
                    if (targetVerse) {
                        await bibleState.resolveVerseText(targetVerse.id);
                        const cue = await bibleState.generateChapterCue(
                            targetVerse.id,
                        );
                        presentation.fire(
                            cue,
                            `verse_${targetVerse.id}`,
                            `slide_${targetVerse.id}_0`,
                        );
                        goto("/operator");
                        closeFinder();
                        return;
                    }
                }
            } else {
                bibleState.selectBook(bookId);
            }
            goto("/operator/bibles");
        } else if (result.type === "bible_fts") {
            const ftsItem = result.payload as FtsSearchResult;
            const regex =
                /^(\d?\s*[a-zA-Z]+(?:[\s-]*[a-zA-Z]+)*)\s+(\d+):(\d+)$/i;
            const match = ftsItem.reference.match(regex);
            if (match) {
                const bookQuery = match[1].trim().toLowerCase();
                const chapterNum = match[2];
                const verseNum = match[3];

                const matchedBooks = bibleState.books.filter((b) =>
                    b.name.toLowerCase().includes(bookQuery),
                );
                const book =
                    matchedBooks.find(
                        (b) => b.name.toLowerCase() === bookQuery,
                    ) || matchedBooks[0];

                if (book) {
                    await bibleState.selectBook(book.id);
                    const targetChapter = bibleState.chapters.find(
                        (c) => c.number === chapterNum,
                    );
                    if (targetChapter) {
                        await bibleState.selectChapter(targetChapter.id);
                        const targetVerse = bibleState.verses.find((v) =>
                            v.reference.endsWith(`:${verseNum}`),
                        );
                        if (targetVerse) {
                            await bibleState.resolveVerseText(targetVerse.id);
                            const cue = await bibleState.generateChapterCue(
                                targetVerse.id,
                            );
                            presentation.fire(
                                cue,
                                `verse_${targetVerse.id}`,
                                `slide_${targetVerse.id}_0`,
                            );
                            goto("/operator");
                        }
                    }
                }
            }
        } else if (result.type === "media") {
            const mediaItem = result.payload;
            const safeUrl =
                mediaItem.asset_url ||
                (mediaItem.filepath ? convertFileSrc(mediaItem.filepath) : "");
            if (safeUrl) presentation.setBackground(safeUrl, mediaItem.type);
        }

        closeFinder(); // <-- NEW: Close the spotlight after firing
    }
</script>

{#if isOpen}
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200"
    >
        <!-- Click outside to close -->
        <div class="absolute inset-0" onclick={closeFinder}></div>

        <!-- Spotlight Modal -->
        <div
            class="relative w-full max-w-3xl bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col max-h-[70vh] overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
        >
            <!-- Super-sized Search Input -->
            <div class="flex items-center px-6 py-5 gap-4 bg-zinc-900/50">
                <Search size={28} class="text-neon-violet shrink-0" />
                <input
                    bind:this={searchInput}
                    bind:value={searchQuery}
                    onkeydown={handleInputKeydown}
                    type="text"
                    placeholder="Search songs, scripture, or media..."
                    class="flex-1 bg-transparent text-2xl font-medium outline-none placeholder:text-zinc-600 text-zinc-100"
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                    autocorrect="off"
                />
                <div class="flex items-center gap-2 shrink-0">
                    <kbd
                        class="px-2 py-1 bg-zinc-800 rounded text-[10px] font-bold text-zinc-400 font-sans tracking-widest border border-zinc-700 shadow-sm"
                        >ESC</kbd
                    >
                </div>
            </div>

            <!-- Tab Filters -->
            <div
                class="flex items-center gap-1 px-4 py-2 border-y border-zinc-800/50 bg-zinc-950/50 shrink-0"
            >
                {#each tabs as tab}
                    <button
                        onclick={() => {
                            activeTab = tab.id;
                            searchInput?.focus();
                        }}
                        class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 {activeTab ===
                        tab.id
                            ? 'bg-zinc-800 text-zinc-100'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}"
                    >
                        {#if tab.icon}<tab.icon size={14} />{/if}
                        {tab.label}
                    </button>
                {/each}
            </div>

            <!-- Results Scroll Area -->
            <div
                class="flex-1 overflow-y-auto p-2 custom-scrollbar relative min-h-[100px]"
            >
                {#if !searchQuery}
                    <div
                        class="py-12 flex flex-col items-center justify-center text-muted-foreground opacity-60"
                    >
                        <Search size={32} class="mb-3 opacity-20" />
                        <p class="text-sm font-medium">Quick Finder</p>
                        <p class="text-xs mt-1">
                            Type anywhere and press <kbd
                                class="px-1 py-0.5 bg-zinc-800 rounded"
                                >Enter</kbd
                            > to fire
                        </p>
                    </div>
                {:else if isSearchingBible || isSearchingSongs}
                    <div
                        class="py-12 flex items-center justify-center text-muted-foreground text-sm"
                    >
                        <span class="animate-pulse">Searching...</span>
                    </div>
                {:else if searchResults.length === 0}
                    <div
                        class="py-12 flex items-center justify-center text-muted-foreground text-sm"
                    >
                        No results found for "{searchQuery}"
                    </div>
                {:else}
                    <div class="space-y-1 pb-2">
                        {#each searchResults as result, i}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                onmouseenter={() => (selectedIndex = i)}
                                onclick={() => fireResult(result)}
                                class="group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border {selectedIndex ===
                                i
                                    ? 'bg-neon-violet/15 border-neon-violet/40 shadow-inner'
                                    : 'bg-transparent border-transparent hover:bg-zinc-800/40'}"
                            >
                                <div
                                    class="flex items-center gap-4 overflow-hidden w-full pr-2"
                                >
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
                                        class="shrink-0 w-14 aspect-video rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 overflow-hidden flex items-center justify-center transition-colors {selectedIndex ===
                                        i
                                            ? 'text-neon-violet border-neon-violet/40'
                                            : ''}"
                                    >
                                        {#if result.type === "media" && safeUrl}
                                            {#if result.payload.thumbnail_url}
                                                <img
                                                    src={result.payload
                                                        .thumbnail_url}
                                                    alt={result.title}
                                                    class="w-full h-full object-cover"
                                                />
                                            {:else if result.payload.type === "video" && safeUrl}
                                                <video
                                                    src="{safeUrl}#t=0.1"
                                                    class="w-full h-full object-cover"
                                                    preload="metadata"
                                                    muted
                                                ></video>
                                            {:else if safeUrl}
                                                <img
                                                    src={safeUrl}
                                                    alt={result.title}
                                                    class="w-full h-full object-cover"
                                                />
                                            {/if}
                                        {:else if result.type === "song"}
                                            <Music size={16} />
                                        {:else if result.type === "bible_nav" || result.type === "bible_fts" || result.type === "version_switch"}
                                            <BookOpen size={16} />
                                        {:else}
                                            <ImageIcon size={16} />
                                        {/if}
                                    </div>

                                    <div class="flex flex-col truncate flex-1">
                                        <span
                                            class="text-base font-bold text-zinc-100 truncate {result.type ===
                                            'bible_fts'
                                                ? 'text-violet-400'
                                                : ''}"
                                        >
                                            {result.title}
                                        </span>
                                        {#if result.isHtml}
                                            <span
                                                class="text-sm text-zinc-400 truncate"
                                                >{@html result.subtitle}</span
                                            >
                                        {:else}
                                            <span
                                                class="text-sm text-zinc-500 truncate {result.subtitle ===
                                                'Matches in lyrics'
                                                    ? 'italic'
                                                    : ''}"
                                            >
                                                {result.subtitle}
                                            </span>
                                        {/if}
                                    </div>
                                </div>

                                <!-- Action Buttons Container -->
                                <div class="flex items-center gap-2 shrink-0">
                                    {#if result.type === "song" || result.type === "media"}
                                        <div
                                            class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
                                            onclick={(e) => e.stopPropagation()}
                                        >
                                            <AddToPlaylistMenu
                                                cueId={result.payload.id}
                                                cueType={result.type}
                                                direction="down"
                                                align="right"
                                            >
                                                <button
                                                    class="p-2 text-zinc-500 hover:text-neon-cyan hover:bg-zinc-800 rounded-lg transition-colors"
                                                    title="Add to Playlist"
                                                >
                                                    <ListPlus size={18} />
                                                </button>
                                            </AddToPlaylistMenu>
                                        </div>
                                    {/if}

                                    {#if selectedIndex === i}
                                        <button
                                            class="shrink-0 px-4 py-2 bg-neon-violet text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_rgba(139,92,246,0.3)] animate-in fade-in slide-in-from-right-2"
                                        >
                                            <Play
                                                size={12}
                                                class="fill-current"
                                            />
                                            {result.type === "version_switch"
                                                ? "Apply"
                                                : "Fire"}
                                        </button>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
