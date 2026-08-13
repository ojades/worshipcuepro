<!-- src/routes/operator/media/+page.svelte -->
<script lang="ts">
    import {
        Search,
        Upload,
        Play,
        Pause,
        Trash2,
        Video,
        CheckSquare,
        XSquare,
        FolderInput,
        Loader2,
        Volume2,
        VolumeX,
        FastForward,
        X,
    } from "@lucide/svelte";
    import { media, type Media } from "$lib/state/media.svelte";
    import { onMount } from "svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import {
        confirmDialog,
        type ConfirmDialogOptions,
    } from "$lib/utils/helper";
    import { invoke } from "@tauri-apps/api/core";
    import { emit } from "@tauri-apps/api/event"; // <-- NEW: Imported native emit

    let activeTab = $state<"images" | "videos">("videos");
    let activeCategory = $state<string>("All");
    let searchQuery = $state("");
    let mediaMetadata = $state<
        Record<string, { dimensions?: string; duration?: string }>
    >({});

    // --- Bulk Selection State ---
    let isSelectMode = $state(false);
    let selectedIds = $state<Set<string>>(new Set());
    let isCategoryDropdownOpen = $state(false);

    let hoverTimer: ReturnType<typeof setTimeout>;
    let activePreviewId = $state<string | null>(null);

    // --- Local Video Sync State for the Scrubber ---
    let localTime = $state(0);
    let localDuration = $state(0);
    let syncVideoNode = $state<HTMLVideoElement | null>(null);

    // Actively control the ghost video so it perfectly mirrors the projector's playback engine
    $effect(() => {
        if (syncVideoNode && presentation.currentBackground) {
            if (
                presentation.currentBackground.isPlaying &&
                syncVideoNode.paused
            ) {
                syncVideoNode.play().catch(() => {});
            } else if (
                !presentation.currentBackground.isPlaying &&
                !syncVideoNode.paused
            ) {
                syncVideoNode.pause();
            }
            syncVideoNode.playbackRate =
                presentation.currentBackground.playbackRate ?? 1.0;
        }
    });

    // Cleanly parse the ugly encoded Tauri URL back into a readable filename
    function getFilenameFromUrl(url: string) {
        if (!url) return "Unknown Media";
        try {
            // Strip any hash or query parameters (like #t=0.1)
            const cleanUrl = url.split("#")[0].split("?")[0];
            // Decode the URL components (%20 -> space, %2F -> /) and pop the filename
            return (
                decodeURIComponent(cleanUrl).split(/[/\\]/).pop() ||
                "Unknown Media"
            );
        } catch {
            return url.split(/[/\\]/).pop() || "Unknown Media";
        }
    }

    function formatScrubberTime(seconds: number) {
        if (!seconds || isNaN(seconds)) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60)
            .toString()
            .padStart(2, "0");
        return `${m}:${s}`;
    }

    async function handleScrub(e: Event) {
        const time = parseFloat((e.target as HTMLInputElement).value);
        localTime = time;
        if (syncVideoNode) {
            syncVideoNode.currentTime = time;
        }
        // Direct frontend-to-frontend emit. Bypasses Rust for instant zero-latency syncing!
        await emit("media-seek", time);
    }

    function handleMouseEnter(id: string) {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
            activePreviewId = id;
        }, 400);
    }

    function handleMouseLeave() {
        clearTimeout(hoverTimer);
        activePreviewId = null;
    }

    function playPreview(node: HTMLVideoElement) {
        node.currentTime = 0;
        const playPromise = node.play();
        if (playPromise !== undefined) playPromise.catch(() => {});
        return {
            destroy() {
                node.pause();
                node.removeAttribute("src");
                node.load();
            },
        };
    }

    onMount(() => {
        media.loadAll();
    });

    function getCategoryCount(cat: string) {
        if (cat === "All") return media.allMedia.length;
        return media.allMedia.filter((m) => m.category === cat).length;
    }

    let filteredMedia: Media[] = $derived(
        media.allMedia.filter((item) => {
            const matchesSearch = (item.filename || "")
                .toLowerCase()
                .includes(searchQuery.toLowerCase());
            const matchesTab =
                item.type === (activeTab === "images" ? "image" : "video");
            const matchesCategory =
                activeCategory === "All" || item.category === activeCategory;
            return matchesSearch && matchesTab && matchesCategory;
        }),
    );

    function handleImageLoad(e: Event, id: string) {
        const img = e.target as HTMLImageElement;
        mediaMetadata[id] = {
            ...mediaMetadata[id],
            dimensions: `${img.naturalWidth} × ${img.naturalHeight}`,
        };
    }

    function handleVideoLoad(e: Event, id: string) {
        const vid = e.target as HTMLVideoElement;
        const minutes = Math.floor(vid.duration / 60);
        const seconds = Math.floor(vid.duration % 60)
            .toString()
            .padStart(2, "0");
        mediaMetadata[id] = {
            ...mediaMetadata[id],
            duration: `${minutes}:${seconds}`,
            dimensions: `${vid.videoWidth} × ${vid.videoHeight}`,
        };
    }

    function toggleSelection(id: string) {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        selectedIds = new Set(selectedIds);
    }

    function toggleSelectAll() {
        if (selectedIds.size === filteredMedia.length) selectedIds.clear();
        else filteredMedia.forEach((m) => selectedIds.add(m.id));
        selectedIds = new Set(selectedIds);
    }

    async function handleBulkCategoryUpdate(newCategory: string) {
        await media.updateCategories(Array.from(selectedIds), newCategory);
        isCategoryDropdownOpen = false;
        isSelectMode = false;
        selectedIds.clear();
    }

    async function handleBulkDelete() {
        const options = {
            message: `Are you sure you want to delete ${selectedIds.size} items?`,
            title: "Delete Media",
            kind: "warning",
        } as ConfirmDialogOptions;

        if (await confirmDialog(options)) {
            await media.bulkDelete(Array.from(selectedIds));
            isSelectMode = false;
            selectedIds.clear();
        }
    }
</script>

<div
    class="flex-1 flex flex-col bg-zinc-950 h-full overflow-hidden rounded-tl-2xl border-t border-l border-zinc-800 relative"
>
    {#if media.isImporting}
        <div
            class="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white"
        >
            <Loader2 class="animate-spin text-neon-violet mb-4" size={48} />
            <p class="font-bold text-lg tracking-widest uppercase">
                Importing Media...
            </p>
        </div>
    {/if}

    <!-- Hidden Sync Video for the Control Bar -->
    <!-- Using opacity-0 w-[1px] instead of 'hidden' prevents browsers from throttling timeupdate events -->
    {#if presentation.currentBackground?.type === "video"}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
            bind:this={syncVideoNode}
            src={presentation.currentBackground.url}
            bind:currentTime={localTime}
            bind:duration={localDuration}
            muted
            loop
            class="absolute opacity-0 pointer-events-none w-[1px] h-[1px] -z-50"
        ></video>
    {/if}

    <!-- TOP HEADER -->
    <div class="border-b border-zinc-800 bg-zinc-950/30 shrink-0 z-10 pt-2">
        <div class="px-6 py-4 flex flex-col gap-4">
            {#if isSelectMode}
                <div
                    class="flex items-center justify-between bg-violet-900/20 border border-violet-500/30 p-2 pl-4 rounded-xl animate-in fade-in zoom-in-95 duration-200"
                >
                    <div
                        class="flex items-center gap-4 text-violet-300 font-bold text-sm"
                    >
                        <span
                            class="bg-violet-600 text-white px-2 py-0.5 rounded text-xs"
                            >{selectedIds.size}</span
                        >
                        Selected
                        <button
                            onclick={toggleSelectAll}
                            class="text-xs hover:text-white underline underline-offset-2 ml-4"
                        >
                            {selectedIds.size === filteredMedia.length
                                ? "Deselect All"
                                : "Select All"}
                        </button>
                    </div>

                    <div class="flex items-center gap-2">
                        <div class="relative">
                            <button
                                onclick={() =>
                                    (isCategoryDropdownOpen =
                                        !isCategoryDropdownOpen)}
                                disabled={selectedIds.size === 0}
                                class="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                                <FolderInput size={16} /> Move to Category
                            </button>
                            {#if isCategoryDropdownOpen}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div
                                    class="fixed inset-0 z-40"
                                    onclick={() =>
                                        (isCategoryDropdownOpen = false)}
                                ></div>
                                <div
                                    class="absolute top-full right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 py-1"
                                >
                                    {#each media.categories as cat}
                                        <button
                                            onclick={() =>
                                                handleBulkCategoryUpdate(cat)}
                                            class="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-violet-600/20 hover:text-violet-400"
                                            >{cat}</button
                                        >
                                    {/each}
                                </div>
                            {/if}
                        </div>

                        <button
                            onclick={handleBulkDelete}
                            disabled={selectedIds.size === 0}
                            class="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                        <div class="w-px h-6 bg-zinc-700 mx-2"></div>
                        <button
                            onclick={() => {
                                isSelectMode = false;
                                selectedIds.clear();
                                isCategoryDropdownOpen = false;
                            }}
                            class="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-sm transition-colors"
                        >
                            <XSquare size={16} /> Cancel
                        </button>
                    </div>
                </div>
            {:else}
                <div class="flex items-center justify-between">
                    <div class="flex gap-8">
                        <button
                            onclick={() => (activeTab = "images")}
                            class="pb-2 px-1 transition-all duration-200 border-b-2 {activeTab ===
                            'images'
                                ? 'border-violet-500 text-zinc-100 font-medium'
                                : 'border-transparent text-zinc-400 hover:text-zinc-300'}"
                            >Images</button
                        >
                        <button
                            onclick={() => (activeTab = "videos")}
                            class="pb-2 px-1 transition-all duration-200 border-b-2 {activeTab ===
                            'videos'
                                ? 'border-violet-500 text-zinc-100 font-medium'
                                : 'border-transparent text-zinc-400 hover:text-zinc-300'}"
                            >Videos</button
                        >
                    </div>

                    <div class="flex gap-3 items-center">
                        <button
                            onclick={() => (isSelectMode = true)}
                            class="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                            title="Select Multiple"
                        >
                            <CheckSquare size={16} /> Select
                        </button>
                        <div class="relative">
                            <Search
                                class="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500"
                                size={18}
                            />
                            <input
                                type="text"
                                placeholder="Search..."
                                bind:value={searchQuery}
                                class="bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-600 focus:ring-1 focus:ring-violet-600 outline-none w-48"
                            />
                        </div>
                        <button
                            onclick={() =>
                                media.importMedia(
                                    activeCategory === "All"
                                        ? "Uncategorized"
                                        : activeCategory,
                                )}
                            class="bg-neon-violet hover:bg-neon-violet/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-neon-violet/20"
                        >
                            <Upload size={16} /> Import
                        </button>
                    </div>
                </div>
            {/if}
        </div>

        <div
            class="px-6 pb-4 flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
            <button
                onclick={() => (activeCategory = "All")}
                class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border flex items-center gap-2 {activeCategory ===
                'All'
                    ? 'bg-violet-600/20 text-violet-400 border-violet-500/30'
                    : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'}"
            >
                All Media
                <span
                    class="text-[10px] px-1.5 py-0.5 rounded-full font-bold {activeCategory ===
                    'All'
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'bg-zinc-800 text-zinc-500'}"
                    >{getCategoryCount("All")}</span
                >
            </button>
            {#each media.categories as category}
                <button
                    onclick={() => (activeCategory = category)}
                    class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border flex items-center gap-2 {activeCategory ===
                    category
                        ? 'bg-violet-600/20 text-violet-400 border-violet-500/30'
                        : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'}"
                >
                    {category}
                    <span
                        class="text-[10px] px-1.5 py-0.5 rounded-full font-bold {activeCategory ===
                        category
                            ? 'bg-violet-500/20 text-violet-300'
                            : 'bg-zinc-800 text-zinc-500'}"
                        >{getCategoryCount(category)}</span
                    >
                </button>
            {/each}
        </div>
    </div>

    <!-- MAIN PANE: Media Grid -->
    <div class="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
        {#if filteredMedia.length === 0}
            <div
                class="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3 border-2 border-dashed border-zinc-800 rounded-xl"
            >
                <Video class="opacity-50" size={48} />
                <p>No media found in {activeCategory}.</p>
            </div>
        {:else}
            <div
                class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 auto-rows-max pb-4"
            >
                {#each filteredMedia as item (item.id)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="group relative bg-zinc-900/50 rounded-xl border p-2 transition-all duration-200 cursor-pointer hover:bg-zinc-900/80
                        {isSelectMode
                            ? selectedIds.has(item.id)
                                ? 'border-violet-500 bg-violet-900/20'
                                : 'border-zinc-800/50 hover:border-zinc-500'
                            : presentation.currentBackground?.url ===
                                item.asset_url
                              ? 'border-violet-500/50 bg-violet-900/10'
                              : 'border-zinc-800/50 hover:border-violet-500/30'}"
                        onclick={() => {
                            if (isSelectMode) {
                                toggleSelection(item.id);
                            } else {
                                media.setActive(item);
                                if (item.asset_url) {
                                    presentation.setBackground(
                                        item.asset_url,
                                        item.type,
                                    );
                                }
                            }
                        }}
                    >
                        {#if isSelectMode}
                            <div
                                class="absolute top-4 left-4 z-20 w-5 h-5 rounded border-2 transition-colors {selectedIds.has(
                                    item.id,
                                )
                                    ? 'bg-violet-500 border-violet-500'
                                    : 'border-white/50 bg-black/30 group-hover:border-white'} flex items-center justify-center shadow-lg"
                            >
                                {#if selectedIds.has(item.id)}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="white"
                                        stroke-width="3"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        ><polyline points="20 6 9 17 4 12"
                                        ></polyline></svg
                                    >
                                {/if}
                            </div>
                        {/if}

                        <!-- Thumbnail -->
                        <div
                            class="aspect-video bg-zinc-800 rounded-lg overflow-hidden relative mb-2 {isSelectMode &&
                            selectedIds.has(item.id)
                                ? 'opacity-80'
                                : ''}"
                            onmouseenter={() =>
                                !isSelectMode && handleMouseEnter(item.id)}
                            onmouseleave={() => {
                                if (!isSelectMode) handleMouseLeave();
                            }}
                        >
                            {#if item.type === "video"}
                                {#if activePreviewId === item.id}
                                    <!-- svelte-ignore a11y_media_has_caption -->
                                    <video
                                        src={item.asset_url}
                                        use:playPreview
                                        class="w-full h-full object-cover"
                                        muted
                                        loop
                                    ></video>
                                {:else if item.thumbnail_url}
                                    <img
                                        src={item.thumbnail_url}
                                        alt={item.filename}
                                        class="w-full h-full object-cover"
                                    />
                                {:else}
                                    <!-- svelte-ignore a11y_media_has_caption -->
                                    <video
                                        src="{item.asset_url}#t=0.1"
                                        preload="metadata"
                                        class="w-full h-full object-cover"
                                        muted
                                    ></video>
                                {/if}
                                {#if mediaMetadata[item.id]?.duration}
                                    <div
                                        class="absolute bottom-1 right-1 bg-black/70 text-zinc-100 text-[10px] font-medium px-1.5 py-0.5 rounded"
                                    >
                                        {mediaMetadata[item.id].duration}
                                    </div>
                                {/if}
                            {:else}
                                <img
                                    src={item.asset_url}
                                    alt={item.filename}
                                    class="w-full h-full object-cover"
                                    onload={(e) => handleImageLoad(e, item.id)}
                                />
                            {/if}

                            {#if !isSelectMode && presentation.currentBackground?.url === item.asset_url}
                                <div
                                    class="absolute inset-0 border-2 border-violet-500 rounded-lg pointer-events-none"
                                ></div>
                                <div
                                    class="absolute top-2 left-2 bg-violet-600 text-xs font-bold px-2 py-0.5 rounded shadow"
                                >
                                    LIVE
                                </div>
                            {/if}
                        </div>

                        <!-- Metadata -->
                        <div class="space-y-1 px-1">
                            <p
                                class="text-sm text-zinc-300 font-medium truncate"
                                title={item.filename}
                            >
                                {item.filename}
                            </p>
                            <div class="flex justify-between items-center">
                                <p
                                    class="text-[10px] text-zinc-500 truncate max-w-[60%]"
                                >
                                    {item.category}
                                </p>
                                <p
                                    class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold"
                                >
                                    {item.type || "VIDEO"}
                                </p>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- BOTTOM FIXED CONTROL BAR -->
    {#if presentation.currentBackground}
        <div
            class="shrink-0 h-16 bg-zinc-950 border-t border-zinc-800 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] flex items-center justify-between px-6 z-20 animate-in slide-in-from-bottom duration-300"
        >
            <div class="flex items-center gap-3 w-1/4 min-w-0">
                <div
                    class="h-10 w-16 bg-zinc-800 rounded overflow-hidden shrink-0 border border-zinc-700 relative"
                >
                    {#if presentation.currentBackground.type === "video"}
                        <!-- svelte-ignore a11y_media_has_caption -->
                        <video
                            src="{presentation.currentBackground.url}#t=0.1"
                            class="w-full h-full object-cover"
                            muted
                        ></video>
                    {:else}
                        <img
                            src={presentation.currentBackground.url}
                            class="w-full h-full object-cover"
                            alt="Playing"
                        />
                    {/if}
                </div>
                <div class="flex flex-col min-w-0">
                    <span
                        class="text-xs font-bold text-violet-400 uppercase tracking-wider"
                        >Now Playing</span
                    >
                    <span class="text-sm text-zinc-200 font-medium truncate">
                        {getFilenameFromUrl(presentation.currentBackground.url)}
                    </span>
                </div>
            </div>

            {#if presentation.currentBackground.type === "video"}
                <div
                    class="flex-1 flex flex-col items-center justify-center max-w-xl mx-4 gap-1"
                >
                    <div class="flex items-center gap-4 w-full">
                        <span
                            class="text-[10px] font-mono text-zinc-500 w-10 text-right"
                            >{formatScrubberTime(localTime)}</span
                        >
                        <input
                            type="range"
                            min="0"
                            max={localDuration || 100}
                            value={localTime}
                            oninput={handleScrub}
                            class="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-violet-500"
                        />
                        <span class="text-[10px] font-mono text-zinc-500 w-10"
                            >{formatScrubberTime(localDuration)}</span
                        >
                    </div>
                </div>

                <div class="flex items-center gap-3 w-1/4 justify-end">
                    <button
                        onclick={() => presentation.toggleMediaPlay()}
                        class="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-full transition-colors border border-zinc-800 hover:border-zinc-700 shadow-sm"
                        title={presentation.currentBackground.isPlaying
                            ? "Pause"
                            : "Play"}
                    >
                        {#if presentation.currentBackground.isPlaying}
                            <Pause size={18} class="fill-current" />
                        {:else}
                            <Play size={18} class="fill-current ml-0.5" />
                        {/if}
                    </button>

                    <div class="w-px h-6 bg-zinc-800"></div>

                    <button
                        onclick={() => presentation.toggleMediaMute()}
                        class="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-full transition-colors"
                        title={presentation.currentBackground.isMuted
                            ? "Unmute"
                            : "Mute"}
                    >
                        {#if presentation.currentBackground.isMuted}
                            <VolumeX size={18} />
                        {:else}
                            <Volume2 size={18} />
                        {/if}
                    </button>

                    <div
                        class="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 ml-2"
                    >
                        <FastForward size={14} class="text-zinc-500" />
                        <select
                            class="bg-transparent text-xs text-zinc-300 outline-none cursor-pointer font-medium appearance-none"
                            value={presentation.currentBackground.playbackRate}
                            onchange={(e) =>
                                presentation.setMediaSpeed(
                                    parseFloat(e.currentTarget.value),
                                )}
                        >
                            <option value={0.5}>0.5x</option>
                            <option value={0.75}>0.75x</option>
                            <option value={1.0}>1x</option>
                            <option value={1.25}>1.25x</option>
                            <option value={1.5}>1.5x</option>
                            <option value={2.0}>2x</option>
                        </select>
                    </div>

                    <div class="w-px h-6 bg-zinc-800 ml-1"></div>

                    <button
                        onclick={() => {
                            presentation.isBackgroundCleared = true;
                            presentation.currentBackground = null;
                            presentation.broadcastState();
                        }}
                        class="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors ml-1"
                        title="Clear Media"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>
            {:else}
                <div class="flex-1 flex justify-end">
                    <button
                        onclick={() => {
                            presentation.isBackgroundCleared = true;
                            presentation.currentBackground = null;
                            presentation.broadcastState();
                        }}
                        class="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                        title="Clear Media"
                    >
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    /* Styling for the custom slider track */
    input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #8b5cf6;
        cursor: pointer;
        transition: transform 0.1s;
    }
    input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.3);
    }
</style>
