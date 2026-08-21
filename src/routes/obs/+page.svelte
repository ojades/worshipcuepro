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

    let customTemplates = $state({
        lyric: "",
        bible: "",
    });

    let ws: WebSocket;
    let reconnectTimer: number;

    let filterType = $state<string | null>(null);

    function renderTemplate(template: string, text: string, subText?: string) {
        if (!template) return "";
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

                if (data.templates) {
                    customTemplates = data.templates;
                }

                if (data.type === null || data.text === "") {
                    activeCue = { type: null, text: "", subText: "" };
                } else {
                    if (!filterType || data.type === filterType) {
                        activeCue = data;
                    } else {
                        activeCue = { type: null, text: "", subText: "" };
                    }
                }
            } catch (err) {
                console.error("Failed to parse cue data:", err);
            }
        };

        ws.onclose = () => {
            activeCue = { type: null, text: "", subText: "" };
            reconnectTimer = setTimeout(connectWebSocket, 2000);
        };
    }

    onMount(() => {
        filterType = new URLSearchParams(window.location.search).get("type");
        connectWebSocket();
    });

    onDestroy(() => {
        if (ws) {
            ws.onclose = null;
            ws.close();
        }
        clearTimeout(reconnectTimer);
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
<div
    class="w-screen h-screen flex flex-col pb-16 px-24 {activeCue.text
        ? 'wcp-body'
        : ''}"
>
    {#if activeCue.type !== null}
        <!-- Lower Third Container with entrance/exit animations -->
        <div
            in:fly={{ y: 50, duration: 400, delay: 100 }}
            out:fade={{ duration: 200 }}
            class="w-full max-w-7xl mx-auto flex flex-col gap-2 wcp-wrapper"
        >
            <!-- BIBLE RENDERER -->
            {#if activeCue.type === "bible"}
                {#if customTemplates.bible?.trim()}
                    {@html renderTemplate(
                        customTemplates.bible,
                        activeCue.text,
                        activeCue.subText,
                    )}
                {:else}
                    <div
                        class="bg-zinc-900/90 backdrop-blur-md border-l-4 border-violet-500 rounded-r-2xl shadow-2xl p-6 wcp-bible-cont"
                    >
                        <p
                            class="text-white text-3xl font-serif leading-tight drop-shadow-md whitespace-pre-wrap wcp-bible-text"
                        >
                            {activeCue.text}
                        </p>
                    </div>
                    <div class="w-full flex justify-end wcp-bible-ref">
                        <div
                            class="bg-violet-600/95 backdrop-blur-md self-start rounded-b-xl rounded-tr-xl px-6 py-2 ml-4 shadow-xl wcp-bible-ref-cont"
                        >
                            <p
                                class="text-violet-50 text-xl font-bold tracking-wide uppercase wcp-bible-ref-text"
                            >
                                {activeCue.subText}
                            </p>
                        </div>
                    </div>
                {/if}

                <!-- LYRIC RENDERER -->
            {:else if activeCue.type === "lyric"}
                {#if customTemplates.lyric?.trim()}
                    {@html renderTemplate(
                        customTemplates.lyric,
                        activeCue.text,
                        activeCue.subText,
                    )}
                {:else}
                    <div class="text-center w-full wcp-lyric-cont">
                        <p
                            class="text-white text-5xl font-bold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] whitespace-pre-wrap wcp-lyric-text"
                            style="-webkit-text-stroke: 1px rgba(0,0,0,0.5);"
                        >
                            {activeCue.text}
                        </p>
                        {#if activeCue.subText}
                            <p
                                class="text-zinc-200 text-3xl font-medium mt-2 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] wcp-lyric-subtext"
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
