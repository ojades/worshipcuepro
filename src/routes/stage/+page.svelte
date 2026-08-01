<!-- src/routes/stage/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { listen, emit, type UnlistenFn } from "@tauri-apps/api/event";
    import type { PresentationPayload } from "$lib/types/models";
    import StageDisplay from "$lib/components/layout/display/StageDisplay.svelte";

    // --- State ---
    let presentationPayload = $state<PresentationPayload>({});
    let controlsPayload = $state<any>({});

    // Combine them into a single reactive display object
    let displayPayload = $derived({
        ...presentationPayload,
        ...controlsPayload,
    });

    let unlistenPresentation: UnlistenFn;
    let unlistenControls: UnlistenFn;

    onMount(async () => {
        unlistenPresentation = await listen<PresentationPayload>(
            "presentation-update",
            (event) => {
                presentationPayload = event.payload;
            },
        );

        unlistenControls = await listen("controls-update", (event: any) => {
            controlsPayload = event.payload;
        });

        // Request initial states on boot
        await emit("request-presentation-state");
        await emit("request-controls-state");
    });

    onDestroy(() => {
        if (unlistenPresentation) unlistenPresentation();
        if (unlistenControls) unlistenControls();
    });
</script>

<svelte:head>
    <title>Stage Monitor</title>
</svelte:head>

<main class="w-screen h-screen relative bg-black overflow-hidden">
    <StageDisplay display={displayPayload} />
</main>

<style>
    :global(body) {
        margin: 0;
        overflow: hidden;
        background-color: black;
    }
</style>
