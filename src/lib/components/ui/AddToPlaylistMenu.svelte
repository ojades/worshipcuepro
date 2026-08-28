<!-- src/lib/components/ui/AddToPlaylistMenu.svelte -->
<script lang="ts">
    import { playlists } from "$lib/state/playlists.svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { Check } from "@lucide/svelte";
    import type { Snippet } from "svelte";

    let {
        cueId,
        cueType = "song",
        align = "right",
        direction = "down",
        children,
        class: className = "",
        onAdd,
    } = $props<{
        cueId: string | string[];
        cueType?: "song" | "media" | "bible" | "presentation" | "shoot";
        align?: "left" | "right";
        direction?: "up" | "down";
        children: Snippet;
        class?: string;
        onAdd?: () => void;
    }>();

    let isOpen = $state(false);
    let showSuccess = $state(false);

    async function handleAdd(playlistId: string) {
        if (Array.isArray(cueId)) {
            for (const id of cueId) {
                await playlists.addCueToPlaylist(playlistId, id, cueType);
            }
        } else {
            await playlists.addCueToPlaylist(playlistId, cueId, cueType);
        }

        isOpen = false;
        showSuccess = true;

        if (onAdd) onAdd();

        setTimeout(() => {
            showSuccess = false;
        }, 1500);
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="relative inline-block {className}"
    onclick={(e) => {
        e.stopPropagation();
        if (!showSuccess) isOpen = !isOpen;
    }}
    onmousedown={(e) => e.stopPropagation()}
>
    <!-- Trigger -->
    {@render children()}

    <!-- Temporary Success Overlay -->
    {#if showSuccess}
        <div
            class="absolute inset-0 z-20 flex items-center justify-center bg-emerald-500/90 text-white rounded-md animate-in fade-in zoom-in duration-200"
        >
            <Check size={16} strokeWidth={3} />
        </div>
    {/if}

    <!-- Custom Dropdown Menu -->
    {#if isOpen}
        <div
            class="fixed inset-0 z-40 cursor-default"
            onclick={(e) => {
                e.stopPropagation();
                isOpen = false;
            }}
        ></div>

        <!-- Dynamic Classes applied here -->
        <div
            class="absolute w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar flex flex-col py-1 text-left animate-in fade-in duration-200
            {direction === 'up'
                ? 'bottom-full mb-2 slide-in-from-bottom-2'
                : 'top-full mt-2 slide-in-from-top-2'}
            {align === 'left' ? 'left-0' : 'right-0'}"
            onclick={(e) => e.stopPropagation()}
        >
            <div
                class="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/50 mb-1"
            >
                Add to Playlist...
            </div>

            {#if presentation.activePlaylist}
                <button
                    type="button"
                    onclick={() => handleAdd(presentation.activePlaylist!.id)}
                    class="w-full text-left px-3 py-2.5 text-sm text-neon-cyan hover:bg-zinc-800 transition-colors flex items-center justify-between"
                >
                    <span class="truncate font-medium"
                        >Active: {presentation.activePlaylist.name}</span
                    >
                </button>
                <div class="h-px bg-zinc-800/50 my-1 mx-3"></div>
            {/if}

            {#each playlists.allPlaylists as p}
                <button
                    type="button"
                    onclick={() => handleAdd(p.id)}
                    class="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors truncate"
                >
                    {p.name}
                </button>
            {/each}

            {#if playlists.allPlaylists.length === 0}
                <div class="px-4 py-3 text-sm text-zinc-500 italic">
                    No playlists available
                </div>
            {/if}
        </div>
    {/if}
</div>
