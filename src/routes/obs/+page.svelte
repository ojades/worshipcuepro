<!-- /src/routes/obs/+page.svelte -->
<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { onMount, onDestroy } from "svelte";

    let activeCue = $state<{
        type: "lyric" | "bible" | null;
        text: string;
        subText?: string;
    }>({
        type: null,
        text: "",
        subText: "",
    });

    // Hold the custom templates received from the server
    let customTemplates = $state({
        lyric: "",
        bible: "",
    });

    let ws: WebSocket;
    let reconnectTimer: number;

    // --- TEMPLATE PARSER ---
    function renderTemplate(template: string, text: string, subText?: string) {
        if (!template) return "";

        // Convert newlines to <br/> tags so they render properly in raw HTML
        const formattedText = text.replace(/\n/g, "<br/>");

        return template
            .replace(/{{text}}/g, formattedText)
            .replace(/{{subText}}/g, subText || "");
    }

    function connectWebSocket() {
        const host = window.location.hostname || "127.0.0.1";
        ws = new WebSocket(`ws://${host}:8080/ws`);

        ws.onopen = () => {
            console.log("Connected to WorshipCuePro OBS Server");
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type !== "obs-update" || !message.payload) {
                    return;
                }

                const data = message.payload;
                console.log(data);

                // Grab custom templates if the server sent them
                if (data.templates) {
                    customTemplates = data.templates;
                }

                if (data.type === null || data.text === "") {
                    activeCue = { type: null, text: "", subText: "" };
                } else {
                    activeCue = data;
                }
            } catch (err) {
                console.error("Failed to parse cue data:", err);
            }
        };

        ws.onclose = () => {
            activeCue = { type: null, text: "", subText: "" };
            console.log(
                "Disconnected. Attempting to reconnect in 2 seconds...",
            );
            reconnectTimer = setTimeout(connectWebSocket, 2000);
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            ws.close();
        };
    }

    onMount(() => {
        connectWebSocket();
    });

    onDestroy(() => {
        if (ws) {
            ws.onclose = null;
            ws.close();
        }
        clearTimeout(reconnectTimer);
    });

    $effect(() => {
        console.log(customTemplates);
    });
</script>

<svelte:head>
    <style>
        body {
            background-color: transparent !important;
            margin: 0;
            overflow: hidden;
        }
    </style>
</svelte:head>

<!-- The Canvas (1920x1080) -->
<div class="w-screen h-screen flex flex-col justify-end pb-16 px-24">
    {#if activeCue.type !== null}
        <!-- Lower Third Container with entrance/exit animations -->
        <div
            in:fly={{ y: 50, duration: 400, delay: 100 }}
            out:fade={{ duration: 200 }}
            class="w-full max-w-7xl mx-auto flex flex-col gap-2"
        >
            <!-- BIBLE RENDERER -->
            {#if activeCue.type === "bible"}
                {#if customTemplates.bible?.trim()}
                    <!-- Render Custom HTML -->
                    {@html renderTemplate(
                        customTemplates.bible,
                        activeCue.text,
                        activeCue.subText,
                    )}
                {:else}
                    <!-- Fallback Default UI -->
                    <div
                        class="bg-zinc-900/90 backdrop-blur-md border-l-4 border-violet-500 rounded-r-2xl shadow-2xl p-6"
                    >
                        <p
                            class="text-white text-5xl font-serif leading-tight drop-shadow-md whitespace-pre-wrap"
                        >
                            {activeCue.text}
                        </p>
                    </div>
                    <div class="w-full flex justify-end">
                        <div
                            class="bg-violet-600/95 backdrop-blur-md self-start rounded-b-xl rounded-tr-xl px-6 py-2 ml-4 shadow-xl"
                        >
                            <p
                                class="text-violet-50 text-xl font-bold tracking-wide uppercase"
                            >
                                {activeCue.subText}
                            </p>
                        </div>
                    </div>
                {/if}

                <!-- LYRIC RENDERER -->
            {:else if activeCue.type === "lyric"}
                {#if customTemplates.lyric?.trim()}
                    <!-- Render Custom HTML -->
                    {@html renderTemplate(
                        customTemplates.lyric,
                        activeCue.text,
                        activeCue.subText,
                    )}
                {:else}
                    <!-- Fallback Default UI -->
                    <div class="text-center w-full">
                        <p
                            class="text-white text-5xl font-bold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] whitespace-pre-wrap"
                            style="-webkit-text-stroke: 1px rgba(0,0,0,0.5);"
                        >
                            {activeCue.text}
                        </p>
                        {#if activeCue.subText}
                            <p
                                class="text-zinc-200 text-3xl font-medium mt-2 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]"
                            >
                                {activeCue.subText}
                            </p>
                        {/if}
                    </div>
                {/if}
            {/if}
        </div>
    {/if}
</div>
