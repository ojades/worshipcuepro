<!-- src/lib/components/layout/controlpanel/tabs/LibraryTab.svelte -->
<script lang="ts">
    import { Search, Plus, Trash2, Edit2, Check, X } from "@lucide/svelte";
    import { playlists } from "$lib/state/playlists.svelte";
    import { confirm } from "@tauri-apps/plugin-dialog";
    import { onMount } from "svelte";

    let { onPlaylistLoaded } = $props<{ onPlaylistLoaded: () => void }>();

    let searchQuery = $state("");

    // Form State
    let isCreating = $state(false);
    let newPlaylistName = $state("");

    let editingId = $state<string | null>(null);
    let editName = $state("");

    onMount(() => {
        playlists.loadAll();
    });

    let filteredPlaylists = $derived(
        playlists.allPlaylists.filter((p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    );

    async function handleLoadPlaylist(playlist: any) {
        await playlists.loadPlaylist(playlist.id);
        onPlaylistLoaded(); // Switch to the active tab
    }

    // --- CREATE LOGIC ---
    async function submitNewPlaylist() {
        if (newPlaylistName.trim()) {
            await playlists.create(newPlaylistName.trim());
            isCreating = false;
            newPlaylistName = "";
        }
    }

    function cancelCreate() {
        isCreating = false;
        newPlaylistName = "";
    }

    // --- EDIT LOGIC ---
    function startEditing(playlist: any, event: Event) {
        event.stopPropagation();
        editingId = playlist.id;
        editName = playlist.name;
    }

    async function submitEditPlaylist(id: string) {
        const originalName = playlists.allPlaylists.find(
            (p) => p.id === id,
        )?.name;
        if (editName.trim() && editName !== originalName) {
            await playlists.update(id, editName.trim());
        }
        editingId = null;
        editName = "";
    }

    function cancelEdit() {
        editingId = null;
        editName = "";
    }

    // --- DELETE LOGIC ---
    async function deletePlaylist(playlist: any, event: Event) {
        event.stopPropagation();
        const confirmed = await confirm(
            `Are you sure you want to delete "${playlist.name}"?`,
            { title: "Delete Playlist", kind: "warning" },
        );

        if (confirmed) {
            await playlists.delete(playlist.id);
        }
    }
</script>

<div class="flex flex-col gap-3 h-full pb-12">
    <!-- Search & Add Controls -->
    <div class="flex items-center gap-2 shrink-0">
        <div class="relative flex-1">
            <Search
                class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
            />
            <input
                type="text"
                bind:value={searchQuery}
                placeholder="Search playlists..."
                class="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs focus:border-neon-cyan outline-none text-foreground placeholder:text-muted-foreground/50 transition-colors"
            />
        </div>
        <button
            onclick={() => {
                isCreating = true;
                searchQuery = "";
            }}
            class="bg-background border border-border hover:border-neon-cyan/50 hover:bg-neon-cyan/10 text-foreground p-1.5 rounded-md transition-colors"
            title="Create new playlist"
        >
            <Plus size={20} />
        </button>
    </div>

    <!-- Create Playlist Inline Form -->
    {#if isCreating}
        <div
            class="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-zinc-900/50 shadow-sm shrink-0"
        >
            <!-- svelte-ignore a11y_autofocus -->
            <input
                type="text"
                bind:value={newPlaylistName}
                placeholder="New playlist name..."
                onkeydown={(e) => {
                    if (e.key === "Enter") submitNewPlaylist();
                    if (e.key === "Escape") cancelCreate();
                }}
                class="flex-1 bg-background border border-border rounded text-sm focus:border-neon-cyan outline-none text-foreground w-full px-3 py-1.5"
                autofocus
            />
            <div class="flex items-center gap-1 self-end">
                <button
                    onclick={submitNewPlaylist}
                    class="p-1.5 text-neon-cyan hover:bg-zinc-700 rounded transition-colors"
                    title="Save"
                >
                    <Check size={16} />
                </button>
                <button
                    onclick={cancelCreate}
                    class="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-zinc-700 rounded transition-colors"
                    title="Cancel"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    {/if}

    <!-- Playlists List -->
    <div class="flex flex-col gap-2" role="list">
        {#each filteredPlaylists as playlist (playlist.id)}
            <div
                role="listitem"
                class="group flex items-start justify-between p-3 rounded-lg border border-zinc-800/50 bg-background hover:border-zinc-700 hover:bg-zinc-800 transition-all"
            >
                {#if editingId && editingId === playlist.id}
                    <!-- Edit Playlist Inline Form -->
                    <div class="flex flex-col gap-2 w-full">
                        <!-- svelte-ignore a11y_autofocus -->
                        <input
                            type="text"
                            bind:value={editName}
                            onkeydown={(e) => {
                                if (e.key === "Enter")
                                    submitEditPlaylist(playlist.id);
                                if (e.key === "Escape") cancelEdit();
                            }}
                            class="w-full bg-background border border-neon-cyan/50 rounded px-3 py-1.5 text-sm outline-none text-foreground"
                            autofocus
                        />
                        <div
                            class="flex items-center justify-end gap-1 shrink-0"
                        >
                            <button
                                onclick={() => submitEditPlaylist(playlist.id)}
                                class="p-1.5 text-neon-cyan hover:bg-zinc-700 rounded transition-colors"
                                title="Save"
                            >
                                <Check size={14} />
                            </button>
                            <button
                                onclick={cancelEdit}
                                class="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                title="Cancel"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                {:else}
                    <!-- Normal Display -->
                    <button
                        class="flex flex-col min-w-0 flex-1 text-left cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-neon-cyan rounded pr-2"
                        onclick={() => handleLoadPlaylist(playlist)}
                        aria-label="Load {playlist.name}"
                    >
                        <span
                            class="text-sm font-semibold text-foreground/90 break-words leading-snug"
                        >
                            {playlist.name}
                        </span>
                        <span class="text-xs text-muted-foreground mt-1">
                            {playlist.cueCount} items
                        </span>
                    </button>

                    <!-- Action buttons -->
                    <div
                        class="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                        <button
                            onclick={(e) => startEditing(playlist, e)}
                            class="p-1.5 text-muted-foreground hover:text-neon-cyan hover:bg-zinc-700 rounded transition-colors"
                            title="Rename Playlist"
                        >
                            <Edit2 size={14} />
                        </button>
                        <button
                            onclick={(e) => deletePlaylist(playlist, e)}
                            class="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            title="Delete Playlist"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                {/if}
            </div>
        {:else}
            <div
                class="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed border-border rounded-lg bg-background/30"
            >
                <span class="text-xs font-medium">No playlists found</span>
            </div>
        {/each}
    </div>
</div>
