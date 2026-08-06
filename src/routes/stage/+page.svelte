<!-- src/routes/stage/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { PresentationPayload } from "$lib/types/models";
    import StageDisplay from "$lib/components/layout/display/StageDisplay.svelte";
    import { fontState } from "$lib/state/fonts.svelte";

    // --- State ---
    let presentationPayload = $state<PresentationPayload | null>(null);
    let controlsPayload = $state<any>({});

    // Combine into a single reactive display object
    let displayPayload: PresentationPayload = $derived({
        ...presentationPayload,
        ...controlsPayload,
    });

    let unlistenPresentation: () => void;
    let unlistenControls: () => void;
    let socket: WebSocket | null = null;

    // Helper to check if running inside Tauri webview
    const isTauri = () =>
        typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    onMount(async () => {
        await fontState.loadFonts();
        if (isTauri()) {
            // --- NATIVE TAURI MODE ---
            const { listen, emit } = await import("@tauri-apps/api/event");

            unlistenPresentation = await listen<PresentationPayload>(
                "presentation-update",
                (event) => {
                    presentationPayload = event.payload;
                },
            );

            unlistenControls = await listen("controls-update", (event: any) => {
                controlsPayload = event.payload;
            });

            await emit("request-presentation-state");
            await emit("request-controls-state");
        } else {
            // --- REMOTE WEB BROWSER MODE ---
            connectWebSocket();
        }
    });

    function connectWebSocket() {
        // Automatically connects to ws://<current-host-ip>:8080/ws
        const wsProtocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

        socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Expecting incoming WebSocket payloads to specify an event type
                if (data.type === "presentation-update") {
                    presentationPayload = data.payload;
                } else if (data.type === "controls-update") {
                    controlsPayload = data.payload;
                } else if (data.text) {
                    // Fallback support if receiving simple CueData from OBS broadcasts
                    presentationPayload = data;
                }
            } catch (err) {
                console.error("Failed to parse WebSocket message", err);
            }
        };

        socket.onclose = () => {
            presentationPayload = null;
            controlsPayload = {};
            // Reconnect automatically if Wi-Fi drops temporarily
            setTimeout(connectWebSocket, 3000);
        };
    }

    onDestroy(() => {
        if (unlistenPresentation) unlistenPresentation();
        if (unlistenControls) unlistenControls();
        if (socket) socket.close();
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
