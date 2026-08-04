<!-- src/routes/operator/media/+page.svelte -->
<script lang="ts">
    import {
        Search,
        Upload,
        Play,
        Trash2,
        Image as ImageIcon,
        Video,
        ListPlus,
    } from "@lucide/svelte";
    import { media } from "$lib/state/media.svelte";
    import { onMount } from "svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import AddToPlaylistMenu from "$lib/components/ui/AddToPlaylistMenu.svelte";
    import {
        confirmDialog,
        type ConfirmDialogOptions,
    } from "$lib/utils/helper";

    let activeTab = $state<"images" | "videos">("videos");
    let searchQuery = $state("");
    let mediaMetadata = $state<
        Record<string, { dimensions?: string; duration?: string }>
    >({});

    // Load media on mount
    onMount(() => {
        media.loadAll();
    });

    // Filter media based on tab and search
    let filteredMedia = $derived(
        media.allMedia.filter((item) => {
            const matchesSearch = (item.filename || "")
                .toLowerCase()
                .includes(searchQuery.toLowerCase());

            const matchesTab =
                item.type === (activeTab === "images" ? "image" : "video");
            return matchesSearch && matchesTab;
        }),
    );

    function formatSize(bytes: number = 0) {
        return "Local File";
    }

    // Extract image dimensions when the img tag loads
    function handleImageLoad(e: Event, id: string) {
        const img = e.target as HTMLImageElement;
        mediaMetadata[id] = {
            ...mediaMetadata[id],
            dimensions: `${img.naturalWidth} × ${img.naturalHeight}`,
        };
    }

    // Extract video duration (and dimensions) when the video tag loads its metadata
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
</script>

<div class="flex-1 flex flex-col min-w-0 bg-zinc-950 h-full">
    <!-- Media Tabs and Search (Sticky Header) -->
    <div
        class="border-b border-zinc-800 bg-zinc-950/30 sticky top-0 z-10 shrink-0"
    >
        <div class="px-6 py-4 space-y-4">
            <!-- Tabs and Actions Row -->
            <div class="flex items-center justify-between">
                <!-- Tabs -->
                <div class="flex gap-8">
                    <button
                        onclick={() => (activeTab = "images")}
                        class="pb-2 px-1 transition-all duration-200 border-b-2 {activeTab ===
                        'images'
                            ? 'border-violet-500 text-zinc-100 font-medium'
                            : 'border-transparent text-zinc-400 hover:text-zinc-300'}"
                    >
                        Images
                    </button>
                    <button
                        onclick={() => (activeTab = "videos")}
                        class="pb-2 px-1 transition-all duration-200 border-b-2 {activeTab ===
                        'videos'
                            ? 'border-violet-500 text-zinc-100 font-medium'
                            : 'border-transparent text-zinc-400 hover:text-zinc-300'}"
                    >
                        Videos
                    </button>
                </div>

                <!-- Actions -->
                <div class="flex gap-3 items-center">
                    <!-- Search -->
                    <div class="relative">
                        <Search
                            size={18}
                            class="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500"
                        />
                        <input
                            type="text"
                            placeholder="Search media..."
                            bind:value={searchQuery}
                            class="bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors outline-none"
                        />
                    </div>

                    <!-- Upload Button -->
                    <button
                        onclick={() => media.importMedia()}
                        class="bg-neon-violet hover:bg-neon-violet/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-neon-violet/20"
                    >
                        <Upload size={16} />
                        Import
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Media Grid -->
    <div class="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
        {#if filteredMedia.length === 0}
            <div
                class="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3 border-2 border-dashed border-zinc-800 rounded-xl"
            >
                <Video size={48} class="opacity-50" />
                <p>No media found. Click Import to add {activeTab}.</p>
            </div>
        {:else}
            <div
                class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-max"
            >
                {#each filteredMedia as item (item.id)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="group bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-2 hover:border-violet-500/30 transition-all duration-200 cursor-pointer hover:bg-zinc-900/80 {media
                            .activeMedia?.id === item.id
                            ? 'border-violet-500/50 bg-violet-900/10'
                            : ''}"
                        onclick={() => {
                            media.setActive(item);
                            if (item.asset_url) {
                                presentation.setBackground(
                                    item.asset_url,
                                    item.type,
                                );
                            }
                        }}
                    >
                        <!-- Thumbnail -->
                        <div
                            class="aspect-video bg-zinc-800 rounded-lg overflow-hidden relative mb-2"
                        >
                            {#if item.asset_url}
                                {#if item.type === "video"}
                                    <video
                                        src="{item.asset_url}#t=0.1"
                                        class="w-full h-full object-cover"
                                        preload="metadata"
                                        muted
                                        onloadedmetadata={(e) =>
                                            handleVideoLoad(e, item.id)}
                                    ></video>

                                    <!-- Video Duration Badge overlay on the thumbnail -->
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
                                        alt={item.filename || item.name}
                                        class="w-full h-full object-cover"
                                        onload={(e) =>
                                            handleImageLoad(e, item.id)}
                                    />
                                {/if}
                            {:else}
                                <div
                                    class="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center"
                                >
                                    <div class="text-zinc-500 text-sm">
                                        No Preview
                                    </div>
                                </div>
                            {/if}

                            <!-- Active Indicator & Hover Overlay -->
                            {#if media.activeMedia?.id === item.id}
                                <div
                                    class="absolute inset-0 border-2 border-violet-500 rounded-lg pointer-events-none"
                                ></div>
                                <div
                                    class="absolute top-2 left-2 bg-violet-600 text-xs font-bold px-2 py-0.5 rounded shadow"
                                >
                                    LIVE
                                </div>
                            {/if}

                            <div
                                class="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none"
                            >
                                <Play
                                    size={32}
                                    class="text-white fill-white opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100"
                                />
                            </div>

                            <!-- Action Bar: Add to Playlist & Delete -->
                            <div
                                class="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <AddToPlaylistMenu
                                    cueId={item.id}
                                    cueType="media"
                                    direction="down"
                                    align="right"
                                >
                                    <button
                                        class="bg-violet-600/90 hover:bg-violet-600 text-white p-1.5 rounded-md shadow-lg"
                                        title="Add to Playlist"
                                    >
                                        <ListPlus size={14} />
                                    </button>
                                </AddToPlaylistMenu>

                                <button
                                    class="bg-red-600/80 hover:bg-red-600 text-white p-1.5 rounded-md shadow-lg"
                                    onclick={async (e) => {
                                        e.stopPropagation();

                                        const options = {
                                            message: `Are you sure you want to delete "${item.filename || item.name}"? This will remove the file from your workspace.`,
                                            title: "Delete Media",
                                            kind: "warning",
                                        } as ConfirmDialogOptions;

                                        if (await confirmDialog(options)) {
                                            await media.delete(item.id);
                                        }
                                    }}
                                    title="Delete Media"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        <!-- Metadata -->
                        <div class="space-y-1 px-1">
                            <p
                                class="text-sm text-zinc-300 font-medium truncate"
                                title={item.filename || item.name}
                            >
                                {item.filename || item.name}
                            </p>
                            <div class="flex justify-between items-center">
                                <!-- Dimensions display -->
                                <p class="text-xs text-zinc-500">
                                    {mediaMetadata[item.id]?.dimensions ||
                                        formatSize()}
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
</div>
