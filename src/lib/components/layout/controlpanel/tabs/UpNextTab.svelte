<!-- src/lib/components/layout/controlpanel/tabs/UpNextTab.svelte -->
<script lang="ts">
    import {
        GripVertical,
        X,
        BookOpen,
        MonitorPlay,
        Music,
    } from "@lucide/svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { playlists } from "$lib/state/playlists.svelte";
    import { dndzone, type DndEvent } from "svelte-dnd-action";
    import { convertFileSrc } from "@tauri-apps/api/core";

    let { onBrowseLibrary } = $props<{ onBrowseLibrary: () => void }>();

    let activeCues = $state<any[]>([]);

    $effect(() => {
        if (presentation.activePlaylist?.cues) {
            activeCues = presentation.activePlaylist.cues.map((cue) => {
                const resolvedUrl =
                    cue.asset_url ||
                    (cue.filepath ? convertFileSrc(cue.filepath) : "");
                return {
                    ...cue,
                    asset_url: resolvedUrl,
                    _originalId: cue.id,
                    id: cue.playlist_item_id, // Force unique ID for DND
                };
            });
        } else {
            activeCues = [];
        }
    });

    function handleDndConsider(e: CustomEvent<DndEvent<any>>) {
        activeCues = e.detail.items;
    }

    async function handleDndFinalize(e: CustomEvent<DndEvent<any>>) {
        activeCues = e.detail.items;

        if (presentation.activePlaylist) {
            const restoredCues = activeCues.map((cue) => ({
                ...cue,
                id: cue._originalId,
            }));

            presentation.activePlaylist.cues = restoredCues;
            await playlists.updateSortOrder(restoredCues);
        }
    }

    async function removeCue(cue: any, event: Event) {
        event.stopPropagation();
        if (presentation.activePlaylist) {
            await playlists.removeCueFromPlaylist(
                cue.playlist_item_id,
                presentation.activePlaylist.id,
            );
        }
    }
</script>

<div
    class="flex flex-col gap-2 pb-12 outline-none"
    use:dndzone={{
        items: activeCues,
        flipDurationMs: 200,
        dropTargetStyle: {},
    }}
    onconsider={handleDndConsider}
    onfinalize={handleDndFinalize}
>
    {#if activeCues.length > 0}
        {#each activeCues as cue (cue.id)}
            {@const isActive = presentation.activeCue?.playlist_item_id
                ? presentation.activeCue.playlist_item_id ===
                  cue.playlist_item_id
                : presentation.activeCue?.id === cue._originalId}

            <div
                class="playlist-item group flex items-start gap-2 p-2 w-full rounded-lg transition-all border {isActive
                    ? 'bg-neon-violet/10 border-neon-violet/30 text-foreground'
                    : 'bg-background border-zinc-800/50 text-muted-foreground hover:bg-zinc-800 hover:border-zinc-700'}"
            >
                <div class="flex-1 flex items-start gap-2 min-w-0">
                    <div
                        class="drag-handle cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-100 transition-opacity p-1 shrink-0 outline-none mt-0.5"
                    >
                        <GripVertical size={14} />
                    </div>

                    <button
                        class="flex-1 flex flex-col items-start text-left overflow-hidden outline-none min-w-0 py-0.5 gap-1"
                        onclick={() =>
                            presentation.fire({
                                ...cue,
                                id: cue._originalId,
                                asset_url: cue.asset_url,
                            })}
                    >
                        <div class="flex items-start gap-3 w-full">
                            <!-- Standardized 16:9 Thumbnail / Icon Box -->
                            <div
                                class="w-20 aspect-video shrink-0 bg-zinc-900 rounded-md overflow-hidden flex items-center justify-center border border-zinc-800/50 shadow-sm relative group-hover:border-zinc-700 transition-colors"
                            >
                                {#if cue.type === "media" && cue.asset_url}
                                    {#if cue.media_type === "video"}
                                        <!-- svelte-ignore a11y_media_has_caption -->
                                        <video
                                            src="{cue.asset_url}#t=0.1"
                                            class="w-full h-full object-cover"
                                            preload="metadata"
                                            muted
                                        ></video>
                                    {:else}
                                        <img
                                            src={cue.asset_url}
                                            alt={cue.title}
                                            class="w-full h-full object-cover"
                                        />
                                    {/if}
                                {:else}
                                    <!-- Fallback Icons for Text/Data Cues -->
                                    <div class="opacity-50 text-neon-cyan">
                                        {#if cue.type === "bible"}
                                            <BookOpen size={20} />
                                        {:else if cue.type === "presentation"}
                                            <MonitorPlay size={20} />
                                        {:else}
                                            <Music size={20} />
                                        {/if}
                                    </div>
                                {/if}
                            </div>

                            <!-- Title -->
                            <div class="flex-1 min-w-0 flex flex-col pt-1">
                                <span
                                    class="text-sm font-medium break-words leading-tight"
                                >
                                    {cue.title}
                                </span>
                                {#if cue.type === "media"}
                                    <span
                                        class="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-semibold"
                                    >
                                        {cue.media_type || "MEDIA"}
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </button>
                </div>

                <!-- Action & Status Container -->
                <div class="flex items-center gap-2 shrink-0 mt-1">
                    <button
                        class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-all outline-none"
                        onclick={(e) => removeCue(cue, e)}
                        title="Remove from playlist"
                    >
                        <X size={16} />
                    </button>

                    {#if isActive}
                        <div
                            class="w-2 h-2 rounded-full bg-neon-violet shadow-[0_0_8px_rgba(139,92,246,0.8)]"
                        ></div>
                    {/if}
                </div>
            </div>
        {/each}
    {:else}
        <div
            class="flex flex-col items-center justify-center h-24 rounded-lg border border-dashed border-border bg-background/30 text-muted-foreground gap-2"
        >
            <span class="text-xs">No active playlist loaded</span>
            <button
                class="text-[10px] uppercase tracking-wider font-bold text-neon-cyan hover:underline"
                onclick={onBrowseLibrary}
            >
                Browse Library
            </button>
        </div>
    {/if}
</div>

<style>
    :global(body.dragging-active .playlist-item *) {
        pointer-events: none !important;
    }
</style>
