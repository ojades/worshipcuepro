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
        Link2,
        ListPlus,
    } from "@lucide/svelte";
    import { media, type Media } from "$lib/state/media.svelte";
    import { onMount } from "svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import {
        confirmDialog,
        type ConfirmDialogOptions,
    } from "$lib/utils/helper";
    import { emit } from "@tauri-apps/api/event";
    import AddToPlaylistMenu from "$lib/components/ui/AddToPlaylistMenu.svelte";

    let activeType = $state<"all" | "images" | "videos">("all");
    let activeCategory = $state<string>("All");
    let searchQuery = $state("");
    let mediaMetadata = $state<
        Record<string, { dimensions?: string; duration?: string }>
    >({});

    let isSelectMode = $state(false);
    let selectedIds = $state<Set<string>>(new Set());
    let isCategoryDropdownOpen = $state(false);

    let hoverTimer: ReturnType<typeof setTimeout>;
    let activePreviewId = $state<string | null>(null);

    let localTime = $state(0);
    let localDuration = $state(0);
    let syncVideoNode = $state<HTMLVideoElement | null>(null);

    // --- YouTube Modal State ---
    let showYoutubeModal = $state(false);
    let youtubeUrlInput = $state("");
    let lastSelectedIndex = $state<number | null>(null);

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

    function getFilenameFromUrl(url: string) {
        if (!url) return "Unknown Media";
        try {
            const cleanUrl = url.split("#")[0].split("?")[0];
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
            const matchesType =
                activeType === "all" ||
                item.type === (activeType === "images" ? "image" : "video");
            const matchesCategory =
                activeCategory === "All" || item.category === activeCategory;
            return matchesSearch && matchesType && matchesCategory;
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

    async function submitYoutubeDownload() {
        if (!youtubeUrlInput.trim()) return;
        const url = youtubeUrlInput;
        showYoutubeModal = false;
        youtubeUrlInput = "";

        const success = await media.downloadYoutubeVideo(
            url,
            activeCategory === "All" ? "Uncategorized" : activeCategory,
        );
        if (success) {
            activeType = "all";
        }
    }

    function handleMediaClick(e: MouseEvent, item: Media, index: number) {
        if (isSelectMode) {
            if (e.shiftKey && lastSelectedIndex !== null) {
                const start = Math.min(lastSelectedIndex, index);
                const end = Math.max(lastSelectedIndex, index);

                for (let i = start; i <= end; i++) {
                    selectedIds.add(filteredMedia[i].id);
                }

                selectedIds = new Set(selectedIds);
            } else {
                toggleSelection(item.id);
            }

            lastSelectedIndex = index;
        } else {
            media.setActive(item);
            if (item.asset_url) {
                presentation.setBackground(item.asset_url, item.type);
            }
        }
    }
</script>

<div
    class="flex-1 flex flex-col bg-zinc-950 h-full overflow-hidden rounded-tl-2xl border-t border-l border-zinc-800 relative"
>
    {#if showYoutubeModal}
        <div
            class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
            <div
                class="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
                <div class="p-6">
                    <div class="flex items-center gap-3 mb-2 text-red-500">
                        <Play size={28} />
                        <h2 class="text-xl font-bold text-white">
                            Download from YouTube
                        </h2>
                    </div>
                    <p class="text-sm text-zinc-400 mb-6">
                        Paste a YouTube link below. WorshipCuePro will download
                        the highest quality video locally so it plays smoothly
                        during the service.
                    </p>

                    <div class="relative mb-6">
                        <Link2
                            size={18}
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                        />
                        <input
                            type="text"
                            placeholder="https://youtube.com/watch?v=..."
                            bind:value={youtubeUrlInput}
                            onkeydown={(e) =>
                                e.key === "Enter" && submitYoutubeDownload()}
                            class="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder-zinc-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                            autofocus
                        />
                    </div>

                    <div class="flex justify-end gap-3">
                        <button
                            onclick={() => (showYoutubeModal = false)}
                            class="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onclick={submitYoutubeDownload}
                            disabled={!youtubeUrlInput}
                            class="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            Download Video
                        </button>
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- EXISTING IMPORT OVERLAY -->
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

    <!-- NEW YOUTUBE DOWNLOAD OVERLAY -->
    {#if media.isDownloadingYoutube}
        <div
            class="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white"
        >
            <Loader2 class="animate-spin text-red-500 mb-4" size={48} />
            <p class="font-bold text-lg tracking-widest uppercase text-white">
                Downloading Video...
            </p>
            <p class="text-zinc-400 text-sm mt-2 max-w-sm text-center">
                This may take a minute depending on the video length and your
                internet connection.
            </p>
        </div>
    {/if}

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

                        <!-- NEW: BULK ADD TO PLAYLIST -->
                        <AddToPlaylistMenu
                            cueId={Array.from(selectedIds)}
                            cueType="media"
                            direction="down"
                            align="right"
                            onAdd={() => {
                                isSelectMode = false;
                                selectedIds.clear();
                            }}
                        >
                            <button
                                disabled={selectedIds.size === 0}
                                class="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                                <ListPlus size={16} /> Add to Playlist
                            </button>
                        </AddToPlaylistMenu>

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
                <!-- ... [Keep standard header exact as it was] ... -->
                <div class="flex items-center justify-between">
                    <div class="flex gap-6">
                        <button
                            onclick={() => (activeType = "all")}
                            class="pb-2 px-1 transition-all duration-200 border-b-2 {activeType ===
                            'all'
                                ? 'border-violet-500 text-zinc-100 font-medium'
                                : 'border-transparent text-zinc-400 hover:text-zinc-300'}"
                            >All Types</button
                        >
                        <button
                            onclick={() => (activeType = "images")}
                            class="pb-2 px-1 transition-all duration-200 border-b-2 {activeType ===
                            'images'
                                ? 'border-violet-500 text-zinc-100 font-medium'
                                : 'border-transparent text-zinc-400 hover:text-zinc-300'}"
                            >Images</button
                        >
                        <button
                            onclick={() => (activeType = "videos")}
                            class="pb-2 px-1 transition-all duration-200 border-b-2 {activeType ===
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

        <!-- CATEGORY PILLS (Keep existing) -->
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
                {#each filteredMedia as item, i (item.id)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- FIX: Added hover:z-50 to ensure dropdown overlaps other cards -->
                    <div
                        class="group relative hover:z-50 bg-zinc-900/50 rounded-xl border p-2 transition-all duration-200 cursor-pointer hover:bg-zinc-900/80 {isSelectMode
                            ? selectedIds.has(item.id)
                                ? 'border-violet-500 bg-violet-900/20'
                                : 'border-zinc-800/50 hover:border-zinc-500'
                            : presentation.currentBackground?.url ===
                                item.asset_url
                              ? 'border-violet-500/50 bg-violet-900/10'
                              : 'border-zinc-800/50 hover:border-violet-500/30'}"
                        onclick={(e) => handleMediaClick(e, item, i)}
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

                        <!-- ADD TO PLAYLIST MENU: Moved OUTSIDE the aspect-video overflow-hidden container -->
                        {#if !isSelectMode}
                            <div
                                class="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <AddToPlaylistMenu
                                    cueId={item.id}
                                    cueType="media"
                                    direction="down"
                                    align="right"
                                >
                                    <button
                                        class="p-1.5 bg-black/80 hover:bg-neon-cyan text-white hover:text-black rounded-lg border border-white/10 backdrop-blur-md shadow-xl transition-all"
                                        title="Add to Playlist"
                                    >
                                        <ListPlus size={16} />
                                    </button>
                                </AddToPlaylistMenu>
                            </div>
                        {/if}

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

    <!-- BOTTOM FIXED CONTROL BAR (KEEP EXACTLY THE SAME) -->
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
                        >Currently Playing</span
                    >
                    <span class="text-sm text-zinc-200 font-medium truncate"
                        >{getFilenameFromUrl(
                            presentation.currentBackground.url,
                        )}</span
                    >
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
