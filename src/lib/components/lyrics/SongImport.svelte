<!-- src/lib/components/lyrics/SongImport.svelte -->
<script lang="ts">
    import { getDB } from "$lib/db";
    import {
        geniusClient,
        type GeniusSearchResult,
    } from "$lib/api/genius-client";
    import { songsState } from "$lib/state/songs.svelte";
    import { systemState } from "$lib/state/system.svelte";
    import { open } from "@tauri-apps/plugin-dialog";
    import { readTextFile } from "@tauri-apps/plugin-fs";
    import {
        FilePlus,
        Search,
        FileText,
        CheckCircle2,
        AlertCircle,
    } from "@lucide/svelte";

    let { onClose } = $props<{ onClose: (id?: string) => void }>();

    // Tabs
    let activeTab = $state<"genius" | "files">("genius");

    // Genius State
    let searchQuery = $state("");
    let isSearching = $state(false);
    let isScraping = $state(false);
    let results = $state<GeniusSearchResult[]>([]);
    let selectedSong = $state<GeniusSearchResult | null>(null);
    let previewLyrics = $state<string | null>(null);

    // File Import State
    interface ParsedFile {
        id: string;
        filename: string;
        title: string;
        artist: string;
        lyrics: string;
        status: "pending" | "imported" | "error";
    }
    let parsedFiles = $state<ParsedFile[]>([]);
    let selectedFileId = $state<string | null>(null);
    let selectedFile = $derived(
        parsedFiles.find((f) => f.id === selectedFileId),
    );
    let isParsingFiles = $state(false);
    let isBulkImporting = $state(false);

    // --- GENIUS API LOGIC ---
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

    async function selectGeniusSong(song: GeniusSearchResult) {
        selectedSong = song;
        previewLyrics = null;
        isScraping = true;

        try {
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

    async function handleGeniusImport() {
        if (!selectedSong || !previewLyrics) return;
        const success = await songsState.importSong({
            title: selectedSong.title,
            artist: selectedSong.artist,
            raw_lyrics: previewLyrics,
        });
        if (success) onClose(success);
    }

    // --- FILE IMPORT LOGIC (ProPresenter & TXT) ---

    function extractProPresenterLyrics(rawText: string): string {
        let text = rawText;

        // 1. Pro6 Legacy: Decode Base64 if present (.pro6 XML format)
        if (text.includes("RVTextElement")) {
            const b64matches = text.match(/RVTextElement.*?text="(.*?)"/g);
            if (b64matches) {
                let decoded = "";
                for (let match of b64matches) {
                    const b64 = match.match(/text="(.*?)"/)?.[1];
                    if (b64) {
                        try {
                            decoded += "\n" + atob(b64);
                        } catch (e) {}
                    }
                }
                text = decoded;
            }
        }

        // 2. Clean RTF commands
        text = text.replace(/\\par(d)?(\s)?/g, "\n");
        text = text.replace(/\\[a-zA-Z-]+\d* ?/g, "");
        text = text.replace(/[{}]/g, "");

        // 3. Pro7 (Binary Protobuf): Replace non-printable ASCII characters
        text = text.replace(/[^\x20-\x7E\r\n]+/g, "\n");

        // 4. Aggressively filter out binary junk and metadata
        let cleanLines = text
            .split("\n")
            .map((l) => l.trim())
            .filter((line) => {
                if (!line) return false;

                // Ignore UUIDs
                if (line.match(/^[0-9a-fA-F\-]{36}$/)) return false;
                if (line.match(/\$?[0-9a-fA-F\-]{36}/)) return false;

                // Ignore pure numbers or protobuf array markers (e.g., "1 1 1&", "0")
                if (line.match(/^[0-9\s"&]+$/)) return false;

                // THE VOWEL RULE: Ignore lines WITHOUT vowels (Kills binary artifacts like ?R&, ?Z+, D@@, p@))
                if (
                    !/[aeiouyAEIOUY]/.test(line) &&
                    !["MMM", "HMM", "SHH"].includes(line.toUpperCase())
                )
                    return false;

                // Ignore lines with weird binary symbol combinations
                if (/[@_<>]/.test(line)) return false;

                // Ignore known metadata
                const metadataKeywords = [
                    "colortbl",
                    "Arial",
                    "CMGSans",
                    "Rising Banners",
                    "csgenericrgb",
                    "fonttbl",
                    "expandedcolortbl",
                    "uc1",
                    "margl0",
                    "CocoaLigature",
                    "Regular",
                    "SemiBold",
                    "strokewidth",
                    "strokec",
                    "nosupersub",
                    "highlight",
                    "strikethrough",
                    ".jpg",
                    ".mp4",
                    ".mov",
                    ".png",
                    "C:\\",
                    "Users\\",
                    "Desktop",
                    "Backgrounds",
                    "CONFESSION",
                    "Group",
                ];

                if (
                    metadataKeywords.some((keyword) =>
                        line.toLowerCase().includes(keyword.toLowerCase()),
                    )
                ) {
                    return false;
                }

                // Ignore 1-character lines (Stray binary artifacts like "A" on its own line)
                if (
                    line.length === 1 &&
                    !["I", "O"].includes(line.toUpperCase())
                )
                    return false;

                return true;
            });

        // 5. Final polish: Clean up weird artifacts attached to the surviving text
        cleanLines = cleanLines.map((line) => {
            let cleaned = line;

            // Remove trailing 0s UNLESS they are part of a real number
            cleaned = cleaned.replace(/([^\d])\s*0$/, "$1");

            // Fix broken spaces caused by non-breaking space binary codes
            cleaned = cleaned.replace(/([a-zA-Z])[?*+&]([a-zA-Z])/g, "$1 $2");

            return cleaned;
        });

        return cleanLines.join("\n").trim() || rawText;
    }

    async function handleSelectFiles() {
        const selected = await open({
            multiple: true,
            filters: [
                { name: "Lyrics Files", extensions: ["pro", "pro6", "txt"] },
            ],
        });

        if (!selected) return;
        const filePaths = Array.isArray(selected) ? selected : [selected];

        isParsingFiles = true;
        const newFiles: ParsedFile[] = [];

        for (const file of filePaths) {
            try {
                const pathStr =
                    typeof file === "string" ? file : (file as any).path;
                const filename = pathStr.split(/[/\\]/).pop() || "Unknown";
                const baseName = filename.replace(/\.[^/.]+$/, "");

                let title = baseName;
                let artist = "Unknown Artist";

                // Where the title has a "-" separator, we can use the left as the title and the right as the artist if it exists[cite: 2]
                if (baseName.includes("-")) {
                    const parts = baseName.split("-");
                    title = parts[0].trim();
                    artist = parts.slice(1).join("-").trim();
                }

                const rawContent = await readTextFile(pathStr);
                const cleanLyrics = extractProPresenterLyrics(rawContent);

                newFiles.push({
                    id: crypto.randomUUID(),
                    filename,
                    title,
                    artist,
                    lyrics: cleanLyrics || "No lyrics found.",
                    status: "pending",
                });
            } catch (e) {
                console.error(`Failed to read file: ${file}`, e);
            }
        }

        parsedFiles = [...parsedFiles, ...newFiles];
        isParsingFiles = false;

        if (parsedFiles.length > 0 && !selectedFileId) {
            selectedFileId = parsedFiles[0].id;
        }
    }

    function updateSelectedFileLyrics(newLyrics: string) {
        if (!selectedFileId) return;
        const idx = parsedFiles.findIndex((f) => f.id === selectedFileId);
        if (idx !== -1) {
            parsedFiles[idx].lyrics = newLyrics;
        }
    }

    async function handleBulkImport() {
        isBulkImporting = true;
        let importedCount = 0;

        for (let file of parsedFiles) {
            if (file.status === "pending") {
                const success = await songsState.importSong({
                    title: file.title,
                    artist: file.artist,
                    raw_lyrics: file.lyrics,
                });

                file.status = success ? "imported" : "error";
                if (success) importedCount++;
            }
        }

        isBulkImporting = false;

        systemState.addAlert({
            message: `Successfully imported ${importedCount} song(s)!`,
            type: "success",
        });

        if (parsedFiles.every((f) => f.status === "imported")) {
            onClose();
        }
    }
</script>

<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
>
    <div
        class="flex h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl overflow-hidden"
    >
        <!-- Header & Tabs -->
        <div class="border-b border-zinc-800 bg-zinc-900/50 p-4">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-bold flex items-center gap-2">
                    <FilePlus class="text-neon-cyan" size={24} /> Import Songs
                </h2>
                <button
                    onclick={() => onClose()}
                    class="text-zinc-400 hover:text-white transition-colors"
                    >✕</button
                >
            </div>

            <div class="flex gap-2">
                <button
                    class="flex-1 py-2 rounded-md font-semibold text-sm transition-colors flex justify-center items-center gap-2 {activeTab ===
                    'genius'
                        ? 'bg-neon-violet text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'}"
                    onclick={() => (activeTab = "genius")}
                >
                    <Search size={16} /> Genius API
                </button>
                <button
                    class="flex-1 py-2 rounded-md font-semibold text-sm transition-colors flex justify-center items-center gap-2 {activeTab ===
                    'files'
                        ? 'bg-neon-cyan text-black'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'}"
                    onclick={() => (activeTab = "files")}
                >
                    <FileText size={16} /> ProPresenter / Files
                </button>
            </div>
        </div>

        <!-- ================= GENIUS TAB ================= -->
        {#if activeTab === "genius"}
            <div class="p-4 border-b border-zinc-800 bg-zinc-950">
                <form onsubmit={handleSearch} class="flex gap-2">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Search Genius by title or artist..."
                        class="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-white focus:border-neon-violet outline-none transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={isSearching}
                        class="rounded-lg bg-neon-violet px-6 py-2 font-medium text-white hover:bg-neon-violet/80 disabled:opacity-50"
                    >
                        {isSearching ? "Searching..." : "Search"}
                    </button>
                </form>
            </div>

            <div class="flex flex-1 overflow-hidden">
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
                                ? 'bg-zinc-800 border border-neon-violet/50'
                                : 'border border-transparent'}"
                            onclick={() => selectGeniusSong(song)}
                        >
                            <div class="flex items-center gap-3">
                                {#if song.image_url}<img
                                        src={song.image_url}
                                        alt={song.title}
                                        class="h-10 w-10 rounded object-cover"
                                    />{/if}
                                <div class="flex-1 min-w-0">
                                    <div
                                        class="font-semibold text-white truncate"
                                    >
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
                <div class="flex w-1/2 flex-col bg-zinc-900/50">
                    {#if selectedSong}
                        <div
                            class="flex-1 overflow-y-auto custom-scrollbar p-6"
                        >
                            <h3 class="mb-1 text-2xl font-bold text-white">
                                {selectedSong.title}
                            </h3>
                            <p class="mb-6 text-zinc-400">
                                {selectedSong.artist}
                            </p>
                            {#if isScraping}
                                <div class="text-neon-violet animate-pulse">
                                    Extracting lyrics...
                                </div>
                            {:else if previewLyrics}
                                <div
                                    class="whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-300"
                                >
                                    {previewLyrics}
                                </div>
                            {/if}
                        </div>
                        <div class="border-t border-zinc-800 bg-zinc-950 p-4">
                            <button
                                onclick={handleGeniusImport}
                                disabled={!previewLyrics}
                                class="w-full rounded-lg bg-green-600 py-2.5 font-bold text-white hover:bg-green-700 disabled:opacity-50"
                                >Save to Library</button
                            >
                        </div>
                    {/if}
                </div>
            </div>

            <!-- ================= FILE IMPORT TAB ================= -->
        {:else}
            <div class="flex flex-1 overflow-hidden">
                <!-- File List Sidebar -->
                <div
                    class="w-1/3 overflow-y-auto custom-scrollbar border-r border-zinc-800 flex flex-col"
                >
                    <div
                        class="p-4 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10"
                    >
                        <button
                            onclick={handleSelectFiles}
                            disabled={isParsingFiles}
                            class="w-full rounded-lg bg-zinc-800 hover:bg-zinc-700 py-2.5 font-semibold text-white transition-colors flex items-center justify-center gap-2 border border-zinc-700 disabled:opacity-50"
                        >
                            <FilePlus size={18} />
                            {isParsingFiles ? "Parsing..." : "Browse Files"}
                        </button>
                        <p class="text-[10px] text-zinc-500 text-center mt-2">
                            Supports .pro, .pro6, .txt
                        </p>
                    </div>

                    <div class="p-2 space-y-1">
                        {#if parsedFiles.length === 0}
                            <div class="p-8 text-center text-zinc-500 text-sm">
                                No files selected yet.
                            </div>
                        {/if}
                        {#each parsedFiles as file}
                            <button
                                class="w-full rounded-md p-3 text-left transition-colors flex items-center gap-3 {selectedFileId ===
                                file.id
                                    ? 'bg-zinc-800 border border-neon-cyan/50'
                                    : 'hover:bg-zinc-800/50 border border-transparent'}"
                                onclick={() => (selectedFileId = file.id)}
                            >
                                <div class="flex-1 min-w-0">
                                    <div
                                        class="font-semibold text-white text-sm truncate"
                                    >
                                        {file.title}
                                    </div>
                                    <div class="text-xs text-zinc-400 truncate">
                                        {file.artist} • {file.filename}
                                    </div>
                                </div>
                                {#if file.status === "imported"}
                                    <CheckCircle2
                                        size={16}
                                        class="text-emerald-500 shrink-0"
                                    />
                                {:else if file.status === "error"}
                                    <AlertCircle
                                        size={16}
                                        class="text-red-500 shrink-0"
                                    />
                                {/if}
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Preview & Edit Pane -->
                <div class="flex flex-col w-2/3 bg-zinc-900/50">
                    {#if selectedFile}
                        <div
                            class="border-b border-zinc-800 p-4 flex flex-col gap-2 bg-zinc-900"
                        >
                            <div>
                                <input
                                    type="text"
                                    bind:value={selectedFile.title}
                                    class="bg-transparent text-xl font-bold text-white outline-none border-b border-transparent focus:border-neon-cyan w-full"
                                    placeholder="Song Title"
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    bind:value={selectedFile.artist}
                                    class="bg-transparent text-sm text-zinc-400 outline-none border-b border-transparent focus:border-neon-cyan w-full"
                                    placeholder="Artist Name"
                                />
                            </div>
                            <p class="text-xs text-zinc-500 mt-1">
                                Review & Edit Metadata and Lyrics before
                                importing
                            </p>
                        </div>

                        <div class="flex-1 p-4 overflow-hidden flex flex-col">
                            <textarea
                                value={selectedFile.lyrics}
                                oninput={(e) =>
                                    updateSelectedFileLyrics(
                                        e.currentTarget.value,
                                    )}
                                class="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-sm text-zinc-300 resize-none outline-none focus:border-neon-cyan custom-scrollbar leading-relaxed"
                            ></textarea>
                        </div>
                    {:else}
                        <div
                            class="flex h-full items-center justify-center p-8 text-center text-zinc-500"
                        >
                            Select a parsed file to preview and edit its lyrics.
                        </div>
                    {/if}

                    <!-- Bulk Action Footer -->
                    {#if parsedFiles.length > 0}
                        <div
                            class="border-t border-zinc-800 bg-zinc-950 p-4 flex justify-between items-center"
                        >
                            <span class="text-sm font-semibold text-zinc-400">
                                {parsedFiles.filter(
                                    (f) => f.status === "pending",
                                ).length} pending imports
                            </span>
                            <button
                                onclick={handleBulkImport}
                                disabled={isBulkImporting ||
                                    parsedFiles.filter(
                                        (f) => f.status === "pending",
                                    ).length === 0}
                                class="rounded-lg bg-neon-cyan px-8 py-2.5 font-bold text-black hover:bg-neon-cyan/80 disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                            >
                                {isBulkImporting
                                    ? "Importing..."
                                    : "Import All Pending"}
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>
