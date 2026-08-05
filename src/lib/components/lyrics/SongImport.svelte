<!-- /src/lib/components/lyrics/SongImport.svelte -->
<script lang="ts">
    import { getDB } from "$lib/db";
    import {
        geniusClient,
        type GeniusSearchResult,
    } from "$lib/api/genius-client";
    import { songsState } from "$lib/state/songs.svelte";
    import { systemState } from "$lib/state/system.svelte";

    let { onClose } = $props<{ onClose: (id?: string) => void }>();

    let searchQuery = $state("");
    let isSearching = $state(false);
    let isScraping = $state(false);

    let results = $state<GeniusSearchResult[]>([]);
    let selectedSong = $state<GeniusSearchResult | null>(null);
    let previewLyrics = $state<string | null>(null);

    // Fetch the API key dynamically from your SQLite settings table
    async function getApiKey(): Promise<string> {
        try {
            const db = getDB();
            const res = await db.select<{ value: string }[]>(
                "SELECT value FROM settings WHERE key = 'genius_api_key' LIMIT 1",
            );
            return res[0]?.value || "";
        } catch (e) {
            console.error("Failed to fetch API key", e);
            return "";
        }
    }

    async function handleSearch(e: Event) {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        const apiKey = await getApiKey();
        if (!apiKey) {
            systemState.addAlert({
                message: "Genius API key not configured in settings.",
                type: "error",
            });
            return;
        }

        isSearching = true;
        selectedSong = null;
        previewLyrics = null;

        try {
            results = await geniusClient.search(searchQuery, apiKey);
        } catch (error) {
            systemState.addAlert({
                message: "Failed to search Genius.",
                type: "error",
            });
        } finally {
            isSearching = false;
        }
    }

    async function selectSong(song: GeniusSearchResult) {
        selectedSong = song;
        previewLyrics = null;
        isScraping = true;

        try {
            // Invoke the Rust scraper using the URL
            previewLyrics = await geniusClient.getLyrics(song.url);
        } catch (error) {
            systemState.addAlert({
                message: "Failed to scrape lyrics.",
                type: "error",
            });
        } finally {
            isScraping = false;
        }
    }

    async function handleImport() {
        if (!selectedSong || !previewLyrics) return;

        const success = await songsState.importSong({
            title: selectedSong.title,
            artist: selectedSong.artist,
            raw_lyrics: previewLyrics,
        });

        if (success) onClose();
    }
</script>

<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
>
    <div
        class="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl"
    >
        <!-- Header & Search Bar -->
        <div class="border-b border-zinc-800 p-4">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-bold">Import New Song</h2>
                <button
                    onclick={() => onClose()}
                    class="text-zinc-400 hover:text-white">✕</button
                >
            </div>

            <form onsubmit={handleSearch} class="flex gap-2">
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Search Genius by title or artist..."
                    class="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-white focus:border-neon-violet focus:outline-none focus:ring-1 focus:ring-neon-violet transition-colors"
                />
                <button
                    type="submit"
                    disabled={isSearching}
                    class="rounded-lg bg-neon-violet px-6 py-2 font-medium text-white hover:bg-neon-violet/80 disabled:opacity-50 transition-colors"
                >
                    {isSearching ? "Searching..." : "Search"}
                </button>
            </form>
        </div>

        <!-- Content Area -->
        <div class="flex flex-1 overflow-hidden">
            <!-- Results List -->
            <div
                class="w-1/2 overflow-y-auto custom-scrollbar border-r border-zinc-800 p-2"
            >
                {#if results.length === 0 && !isSearching}
                    <div class="p-8 text-center text-zinc-500">
                        Search for a song to see results
                    </div>
                {/if}

                {#each results as song}
                    <button
                        class="w-full rounded-lg p-3 text-left transition-colors hover:bg-zinc-800 {selectedSong?.id ===
                        song.id
                            ? 'bg-zinc-800 border border-neon-violet/50 shadow-sm'
                            : 'border border-transparent'}"
                        onclick={() => selectSong(song)}
                    >
                        <div class="flex items-center gap-3">
                            {#if song.image_url}
                                <img
                                    src={song.image_url}
                                    alt={song.title}
                                    class="h-10 w-10 rounded object-cover"
                                />
                            {/if}
                            <div class="flex-1 min-w-0">
                                <div class="font-semibold text-white truncate">
                                    {song.title}
                                </div>
                                <div class="text-sm text-zinc-400 truncate">
                                    {song.artist}
                                </div>
                            </div>
                        </div>
                    </button>
                {/each}
            </div>

            <!-- Preview & Import -->
            <div class="flex w-1/2 flex-col bg-zinc-900/50">
                {#if selectedSong}
                    <div class="flex-1 overflow-y-auto custom-scrollbar p-6">
                        <h3 class="mb-1 text-2xl font-bold text-white">
                            {selectedSong.title}
                        </h3>
                        <p class="mb-6 text-zinc-400">{selectedSong.artist}</p>

                        {#if isScraping}
                            <div
                                class="flex items-center gap-2 text-neon-violet animate-pulse"
                            >
                                Extracting lyrics...
                            </div>
                        {:else if previewLyrics}
                            <div
                                class="whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-300"
                            >
                                {previewLyrics}
                            </div>
                        {:else}
                            <div class="text-red-400 text-sm">
                                Failed to extract lyrics.
                            </div>
                        {/if}
                    </div>

                    <div class="border-t border-zinc-800 bg-zinc-950 p-4">
                        <button
                            onclick={handleImport}
                            disabled={!previewLyrics}
                            class="w-full rounded-lg bg-green-600 py-2.5 font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                            Save to Library
                        </button>
                    </div>
                {:else}
                    <div
                        class="flex h-full items-center justify-center p-8 text-center text-zinc-500"
                    >
                        Select a song from the list to extract and preview
                        lyrics.
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
