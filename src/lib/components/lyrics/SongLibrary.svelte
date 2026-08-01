<!-- src/lib/components/lyrics/SongLibrary.svelte -->
<script lang="ts">
    import { Search, Plus, ListPlus } from "@lucide/svelte";
    import Button from "$lib/components/ui/Button.svelte";
    import { playlists } from "$lib/state/playlists.svelte";
    import { presentation } from "$lib/state/presentation.svelte";

    export type Song = {
        id: string;
        title: string;
        artist?: string;
        key?: string;
    };

    let {
        songs = [],
        selectedSongId = null,
        onSongChange,
        onAddSong,
    } = $props<{
        songs: Song[];
        selectedSongId: string | null;
        onSongChange: (id: string) => void;
        onAddSong: () => void;
    }>();

    let searchQuery = $state("");

    let filteredSongs = $derived(
        !searchQuery.trim()
            ? songs
            : songs.filter(
                  (song) =>
                      song.title
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                      (song.artist &&
                          song.artist
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase())),
              ),
    );
</script>

<div class="h-full overflow-hidden flex flex-col bg-background/50">
    <!-- Header -->
    <div class="flex-shrink-0 border-b border-border p-4 space-y-3">
        <div class="flex items-center justify-between">
            <h2
                class="text-sm font-semibold tracking-wider text-muted-foreground uppercase"
            >
                Song Library
            </h2>
            <Button
                variant="primary"
                icon={Plus}
                onclick={onAddSong}
                class="py-1.5 px-3 text-xs"
            >
                <Plus size={14} />
                Add
            </Button>
        </div>

        <!-- Search Input -->
        <div class="relative group">
            <Search
                size={14}
                class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-neon-violet transition-colors"
            />
            <input
                type="text"
                placeholder="Search songs..."
                bind:value={searchQuery}
                class="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:border-neon-violet focus:ring-1 focus:ring-neon-violet transition-colors outline-hidden"
            />
        </div>
    </div>

    <!-- Song List -->
    <div class="flex-1 overflow-y-auto custom-scrollbar">
        <div class="p-2 space-y-1">
            {#each filteredSongs as song (song.id)}
                <div
                    class="group w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 border {selectedSongId ===
                    song.id
                        ? 'bg-zinc-800 border-zinc-700 shadow-sm'
                        : 'bg-transparent border-transparent hover:bg-card hover:border-border'}"
                >
                    <!-- Main Clickable Area -->
                    <button
                        onclick={() => onSongChange(song.id)}
                        class="flex-1 text-left min-w-0 pr-2 cursor-pointer outline-none"
                    >
                        <div
                            class="text-sm font-medium text-foreground truncate"
                        >
                            {song.title}
                        </div>
                        <div
                            class="text-xs text-muted-foreground mt-0.5 truncate"
                        >
                            {#if song.artist}{song.artist}
                            {/if}
                        </div>
                    </button>

                    <!-- Add to Playlist Inline Action -->
                    <div
                        class="relative opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                        <select
                            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            title="Add to playlist"
                            onchange={(e) => {
                                const target = e.target as HTMLSelectElement;
                                if (target.value) {
                                    playlists.addCueToPlaylist(
                                        target.value,
                                        song.id,
                                        "song",
                                    );
                                    target.value = "";
                                }
                            }}
                        >
                            <option value="" disabled selected>Add...</option>
                            {#if presentation.activePlaylist}
                                <option value={presentation.activePlaylist.id}>
                                    Active: {presentation.activePlaylist.name}
                                </option>
                            {/if}
                            <optgroup label="All Playlists">
                                {#each playlists.allPlaylists as p}
                                    <option value={p.id}>{p.name}</option>
                                {/each}
                            </optgroup>
                        </select>

                        <button
                            class="p-1.5 text-neon-violet hover:text-neon-cyan hover:bg-zinc-700 rounded transition-colors"
                            aria-label="Add to Playlist"
                        >
                            <ListPlus size={20} />
                        </button>
                    </div>
                </div>
            {/each}

            {#if filteredSongs.length === 0}
                <div class="text-center text-xs text-muted-foreground py-8">
                    No songs found.
                </div>
            {/if}
        </div>
    </div>
</div>
