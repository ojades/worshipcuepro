<!-- src/routes/operator/lyrics/+page.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import SongLibrary, {
        type Song,
    } from "$lib/components/lyrics/SongLibrary.svelte";
    import LyricsView from "$lib/components/lyrics/LyricsView.svelte";
    import type { Cue, SongCue } from "$lib/types/models";
    import { presentation } from "$lib/state/presentation.svelte";
    import { songsState } from "$lib/state/songs.svelte";
    import { parseLyrics } from "$lib/utils/lyrics";
    import SongImport from "$lib/components/lyrics/SongImport.svelte";

    let selectedSongId = $state<string | null>(null);
    let forceEditMode = $state(false);
    let showImportModal = $state(false);

    // Map DB models to the Library UI
    let songList = $derived(
        songsState.songs.map((s: Song) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
        })),
    );

    // Derive the selected song, and parse raw_lyrics into presentation sections on the fly
    let selectedSong = $derived.by(() => {
        const raw = songsState.songs.find((s) => s.id === selectedSongId);
        if (!raw) return null;

        return {
            ...raw,
            type: "song",
            sections: parseLyrics(raw.raw_lyrics || ""),
        } as SongCue;
    });

    onMount(async () => {
        await songsState.load();
        if (songsState.songs.length > 0 && !selectedSongId) {
            selectedSongId = songsState.songs[0].id;
        }
    });

    function handleSendLive(cue: Cue, sectionId: string, slideId: string) {
        presentation.fire(cue, sectionId, slideId);
    }

    async function handleAddSong() {
        const newId = await songsState.create();
        if (newId) {
            selectedSongId = newId;
            forceEditMode = true;
        }
    }
</script>

<svelte:head>
    <title>Lyrics - WorshipCuePro</title>
</svelte:head>

<div
    class="flex-1 flex min-h-0 bg-background rounded-tl-2xl overflow-hidden border-t border-l border-border"
>
    <!-- Left Pane -->
    <div class="w-80 lg:w-88 flex-shrink-0 border-r border-border h-full">
        <SongLibrary
            songs={songList}
            {selectedSongId}
            onSongChange={(id) => {
                selectedSongId = id;
                forceEditMode = false;
            }}
            onAddSong={handleAddSong}
            onOpenImport={() => (showImportModal = true)}
        />
    </div>

    <!-- Right Pane -->
    <div class="flex-1 h-full min-w-0">
        <!-- forceEditMode triggers the editor open automatically on new song -->
        <LyricsView
            song={selectedSong}
            {forceEditMode}
            onSendLive={handleSendLive}
            onDelete={() => {
                selectedSongId = null;
            }}
        />
    </div>
</div>
{#if showImportModal}
    <SongImport
        onClose={(importedId) => {
            showImportModal = false;
            if (importedId) {
                selectedSongId = importedId;
                forceEditMode = false;
            }
        }}
    />
{/if}
