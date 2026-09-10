<!-- src/routes/stage/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { PresentationPayload } from "$lib/types/models";
    import StageDisplay from "$lib/components/layout/display/StageDisplay.svelte";
    import { fontState } from "$lib/state/fonts.svelte";
    import { getCoreWorkspaceAPI } from "$lib/commands/settings-db";
    import { settingsState } from "$lib/state/settings.svelte";

    let presentationPayload = $state<PresentationPayload | null>(null);
    let controlsPayload = $state<any>({});

    let displayPayload: PresentationPayload = $derived({
        ...presentationPayload,
        ...controlsPayload,
    });

    let unlistenPresentation: () => void;
    let unlistenControls: () => void;
    let socket: WebSocket | null = null;

    const isTauri = () =>
        typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    // Convert relative network time to absolute local time
    function processControlsPayload(raw: any) {
        const now = Date.now();
        const payload = { ...raw }; // FIXED: Clone object to force Svelte Reactivity

        if (
            payload.serviceRemainingMs !== null &&
            payload.serviceRemainingMs !== undefined
        ) {
            payload.localServiceTargetTimestamp =
                now + payload.serviceRemainingMs;
        } else {
            payload.localServiceTargetTimestamp = null;
        }

        if (
            payload.isSpeakerRunning &&
            payload.speakerRemainingMs !== null &&
            payload.speakerRemainingMs !== undefined
        ) {
            payload.localSpeakerTargetTimestamp =
                now + payload.speakerRemainingMs;
            payload.speakerPausedRemainingMs = null;
        } else if (
            !payload.isSpeakerRunning &&
            payload.speakerRemainingMs !== null &&
            payload.speakerRemainingMs !== undefined
        ) {
            payload.localSpeakerTargetTimestamp = null;
            payload.speakerPausedRemainingMs = payload.speakerRemainingMs;
        } else {
            payload.localSpeakerTargetTimestamp = null;
            payload.speakerPausedRemainingMs = null;
        }

        return payload;
    }

    onMount(async () => {
        if (isTauri()) {
            const coreWorkspace = await getCoreWorkspaceAPI();
            if (coreWorkspace) {
                settingsState.workspacePath = coreWorkspace;
                await fontState.loadFonts();
            }
            const { listen, emit } = await import("@tauri-apps/api/event");

            unlistenPresentation = await listen<PresentationPayload>(
                "presentation-update",
                (event) => {
                    presentationPayload = event.payload;
                },
            );

            unlistenControls = await listen("controls-update", (event: any) => {
                controlsPayload = processControlsPayload(event.payload);
            });

            await emit("request-presentation-state");
            await emit("request-controls-state");
        } else {
            connectWebSocket();
        }
    });

    function connectWebSocket() {
        const wsProtocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

        socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "presentation-update") {
                    let payload = data.payload;
                    if (
                        !isTauri() &&
                        payload.liveBackground?.url?.includes(
                            "asset://localhost",
                        )
                    ) {
                        const decodedUrl = decodeURIComponent(
                            payload.liveBackground.url,
                        );
                        const filename = decodedUrl.split(/[/\\]/).pop();
                        if (filename) {
                            payload.liveBackground.url = `/media/${encodeURIComponent(filename)}`;
                        }
                    }
                    presentationPayload = payload;
                } else if (data.type === "controls-update") {
                    controlsPayload = processControlsPayload(data.payload);
                } else if (data.text) {
                    presentationPayload = data;
                }
            } catch (err) {
                console.error("Failed to parse WebSocket message", err);
            }
        };

        socket.onclose = () => {
            presentationPayload = null;
            controlsPayload = {};
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
