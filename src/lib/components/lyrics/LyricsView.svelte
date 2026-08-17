<!-- src/lib/components/lyrics/LyricsView.svelte -->
<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        Play,
        Edit2,
        X,
        Save,
        Settings2,
        Trash2,
        ListPlus,
        AlertCircle,
    } from "@lucide/svelte";
    import Button from "$lib/components/ui/Button.svelte";
    import AddToPlaylistMenu from "$lib/components/ui/AddToPlaylistMenu.svelte";
    import { songsState } from "$lib/state/songs.svelte";
    import { parseLyrics } from "$lib/utils/lyrics";
    import { settingsState } from "$lib/state/settings.svelte";
    import type { SongCue } from "$lib/types/models";

    let {
        song,
        forceEditMode = false,
        onSendLive,
        onDelete,
    } = $props<{
        song: SongCue | null;
        forceEditMode?: boolean;
        onSendLive: (cue: SongCue, sectionId: string, slideId: string) => void;
        onDelete: () => void;
    }>();

    let isEditMode = $state(false);
    let showDeleteConfirm = $state(false);

    // Form States
    let editTitle = $state("");
    let editArtist = $state("");
    let editLyrics = $state("");
    let linesPerSlide = $state<number>(0);
    let defaultLinesPerSlide = $derived(settingsState.config.linesPerSlide);

    // Listen for new song selection or forced edit
    $effect(() => {
        if (song) {
            isEditMode = forceEditMode;
            showDeleteConfirm = false; // Reset delete confirmation on song change
            if (forceEditMode) initEditForm();
            else {
                linesPerSlide = song.lines_per_slide || defaultLinesPerSlide;
            }
        }
    });

    // Stable parses for both edit mode and viewer mode so IDs don't regenerate on every render
    let parsedSections = $derived(parseLyrics(editLyrics, linesPerSlide));
    let viewerSections = $derived(
        song ? parseLyrics(song.raw_lyrics, linesPerSlide) : [],
    );

    function initEditForm() {
        if (!song) return;
        editTitle = song.title;
        editArtist = song.artist || "";
        editLyrics = song.raw_lyrics || "";
        linesPerSlide = song.lines_per_slide || 0;
        showDeleteConfirm = false;
    }

    function handleEditClick() {
        if (!isEditMode) initEditForm();
        isEditMode = !isEditMode;
    }

    async function handleSave() {
        if (!song) return;
        await songsState.update(song.id, {
            title: editTitle,
            artist: editArtist,
            lines_per_slide: linesPerSlide,
            raw_lyrics: editLyrics,
        });
        isEditMode = false;
    }

    async function confirmDelete() {
        if (!song) return;
        const success = await songsState.delete(song.id);
        if (success) {
            isEditMode = false;
            showDeleteConfirm = false;
            onDelete();
        }
    }

    // Helper to fire the slide and navigate
    function handlePlay(sectionId: string, slideId: string) {
        if (!song) return;

        // 1. Fire the slide globally
        onSendLive(
            {
                ...song,
                sections: viewerSections,
            },
            sectionId,
            slideId,
        );

        // 2. Switch to the main Cue view
        goto("/operator");
    }
</script>

{#if !song}
    <div
        class="h-full flex items-center justify-center text-muted-foreground font-medium"
    >
        <p>Select a song from the library to view lyrics</p>
    </div>
{:else}
    <div class="h-full overflow-hidden flex flex-col">
        <!-- Song Header -->
        <div
            class="flex-shrink-0 border-b border-border p-6 space-y-4 bg-background"
        >
            <div class="flex items-start justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-foreground">
                        {song.title}
                    </h1>
                    <div
                        class="flex items-center gap-3 mt-2 text-sm text-muted-foreground"
                    >
                        {#if song.artist}
                            <span class="px-2 py-0.5 bg-zinc-800 rounded-md"
                                >Artist: {song.artist}</span
                            >
                        {/if}
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <!-- REUSABLE ADD TO PLAYLIST MENU -->
                    <AddToPlaylistMenu
                        cueId={song.id}
                        cueType="song"
                        direction="down"
                        align="right"
                    >
                        <Button variant="ghost" icon={ListPlus}>
                            Add to Playlist
                        </Button>
                    </AddToPlaylistMenu>

                    {#if isEditMode}
                        <Button
                            variant="ghost"
                            icon={X}
                            onclick={() => (isEditMode = false)}
                        >
                            Cancel
                        </Button>
                    {:else}
                        <Button
                            variant="primary"
                            icon={Edit2}
                            onclick={handleEditClick}
                        >
                            <Edit2 size={16} class="text-foreground" />
                            Edit
                        </Button>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Main Content -->
        {#if isEditMode}
            <div
                class="flex-1 overflow-hidden flex flex-col gap-4 px-6 py-6 bg-background/30"
            >
                <!-- Metadata Inputs -->
                <div
                    class="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-border shrink-0"
                >
                    <div class="flex flex-col gap-1.5">
                        <label
                            for="title"
                            class="text-xs font-semibold text-muted-foreground uppercase"
                            >Title</label
                        >
                        <input
                            id="title"
                            bind:value={editTitle}
                            placeholder="Song Title"
                            class="bg-background border border-border text-sm rounded-lg px-3 py-2 outline-none focus:border-neon-violet transition-colors"
                        />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label
                            for="artist"
                            class="text-xs font-semibold text-muted-foreground uppercase"
                            >Artist</label
                        >
                        <input
                            id="artist"
                            bind:value={editArtist}
                            placeholder="Artist Name"
                            class="bg-background border border-border text-sm rounded-lg px-3 py-2 outline-none focus:border-neon-violet transition-colors"
                        />
                    </div>
                </div>

                <!-- Layout Options & Actions -->
                <div class="flex items-center justify-between shrink-0">
                    <div
                        class="flex items-center gap-4 p-2 bg-card border border-border rounded-lg inline-flex"
                    >
                        <Settings2
                            size={16}
                            class="text-muted-foreground ml-1"
                        />
                        <div class="flex items-center gap-2 pr-1">
                            <label
                                for="lines"
                                class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                            >
                                Max Lines Per Slide
                            </label>
                            <select
                                id="lines"
                                bind:value={linesPerSlide}
                                class="bg-background border border-border text-xs rounded px-2 py-1 outline-none focus:border-neon-violet"
                            >
                                <option value={0}>Auto (Blank lines)</option>
                                <option value={2}>2 Lines (Lower Thirds)</option
                                >
                                <option value={4}>4 Lines</option>
                                <option value={6}>6 Lines</option>
                            </select>
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                        <!-- SLEEK INLINE DELETE CONFIRMATION -->
                        {#if showDeleteConfirm}
                            <div
                                class="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200 bg-red-950/30 border border-red-900/50 rounded-lg p-1 pr-2"
                            >
                                <Button
                                    variant="ghost"
                                    onclick={() => (showDeleteConfirm = false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    onclick={confirmDelete}
                                >
                                    Confirm
                                </Button>
                            </div>
                        {:else}
                            <Button
                                variant="danger"
                                icon={Trash2}
                                onclick={() => (showDeleteConfirm = true)}
                            >
                                Delete
                            </Button>
                        {/if}

                        <Button
                            variant="primary"
                            icon={Save}
                            onclick={handleSave}>Save</Button
                        >
                    </div>
                </div>

                <textarea
                    bind:value={editLyrics}
                    placeholder="Paste or type lyrics here... Use 'Verse 1', 'Chorus', etc. to create sections."
                    class="flex-1 bg-background border border-border text-foreground text-xl leading-relaxed font-mono px-6 py-6 rounded-xl focus:border-neon-violet focus:ring-1 focus:ring-neon-violet outline-none resize-none"
                ></textarea>

                <div
                    class="h-1/3 overflow-y-auto pr-2 custom-scrollbar border-t border-border pt-4 mt-2"
                >
                    <h3
                        class="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3"
                    >
                        Live Preview
                    </h3>
                    <div class="space-y-3">
                        {#each parsedSections as section}
                            {#each section.slides as slide}
                                <div
                                    class="relative bg-card rounded-xl border border-border p-4"
                                >
                                    <div
                                        class="text-[10px] uppercase tracking-widest font-bold text-neon-cyan bg-neon-cyan/10 inline-block rounded-full px-2 py-0.5 mb-2"
                                    >
                                        {section.title}
                                    </div>
                                    <div
                                        class="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium"
                                    >
                                        {slide.text}
                                    </div>
                                </div>
                            {/each}
                        {/each}
                    </div>
                </div>
            </div>
        {:else}
            <!-- Viewer Layout -->
            <div
                class="flex-1 overflow-y-auto px-6 py-6 bg-background/30 custom-scrollbar"
            >
                <div class="space-y-4 max-w-3xl">
                    {#each viewerSections as section}
                        {#each section.slides as slide}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                ondblclick={() =>
                                    handlePlay(section.id, slide.id)}
                                class="group relative bg-card rounded-xl border border-border transition-all duration-200 p-5 hover:border-neon-violet/50 hover:bg-neon-violet/5 hover:shadow-lg hover:shadow-neon-violet/5 select-none cursor-pointer"
                            >
                                <div
                                    class="text-[10px] uppercase tracking-widest font-bold text-neon-cyan bg-neon-cyan/10 inline-block rounded-full px-2 py-0.5 mb-3"
                                >
                                    {section.title}
                                </div>
                                <div
                                    class="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap font-medium"
                                >
                                    {slide.text}
                                </div>
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handlePlay(section.id, slide.id);
                                    }}
                                    class="absolute top-1/2 -translate-y-1/2 right-6 p-3 bg-neon-violet hover:bg-neon-violet-dark text-white rounded-full transition-all duration-200 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 shadow-xl shadow-neon-violet/30"
                                >
                                    <Play
                                        size={18}
                                        fill="currentColor"
                                        class="ml-0.5"
                                    />
                                </button>
                            </div>
                        {/each}
                    {/each}
                </div>
            </div>
        {/if}
    </div>
{/if}
