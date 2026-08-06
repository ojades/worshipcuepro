<!-- src/routes/projector/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { listen, emit, type UnlistenFn } from "@tauri-apps/api/event";
    import ProjectorDisplay, {
        type ExtendedPayload,
    } from "$lib/components/layout/display/ProjectorDisplay.svelte";
    import { fontState } from "$lib/state/fonts.svelte";

    // Store payloads separately
    let presentationPayload = $state<ExtendedPayload>({
        liveText: "",
        nextText: "",
        liveBackground: null,
        isBlackout: false,
        isTextCleared: false,
        liveReference: null,
        projector: null,
        stage: null,
    });

    let controlsPayload = $state<any>({});

    // Derive a single merged display object for the component
    let displayPayload = $derived({
        ...presentationPayload,
        ...controlsPayload,
    });

    let unlistenPresentation: UnlistenFn;
    let unlistenControls: UnlistenFn;

    onMount(async () => {
        await fontState.loadFonts();
        unlistenPresentation = await listen<ExtendedPayload>(
            "presentation-update",
            (event) => {
                presentationPayload = {
                    ...presentationPayload,
                    ...event.payload,
                };
            },
        );

        unlistenControls = await listen("controls-update", (event: any) => {
            controlsPayload = event.payload;
        });

        // Request states on load
        await emit("request-presentation-state");
        await emit("request-controls-state");
    });

    onDestroy(() => {
        if (unlistenPresentation) unlistenPresentation();
        if (unlistenControls) unlistenControls();
    });
</script>

<main class="w-screen h-screen relative bg-black overflow-hidden">
    <div class="absolute inset-0 z-0">
        <ProjectorDisplay display={displayPayload} />
    </div>
</main>

<style>
    :global(body) {
        margin: 0;
        overflow: hidden;
        background-color: black;
    }
</style>
