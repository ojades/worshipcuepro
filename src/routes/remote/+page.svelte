<!-- /src/routes/remote/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        ChevronLeft,
        ChevronRight,
        XSquare,
        MonitorX,
    } from "@lucide/svelte";
    import Timers from "./components/timers.svelte";

    let socket: WebSocket | null = $state(null);
    let presentationData = $state<any>(null);
    let controlsData = $state<any>(null);
    let activeTab: "control" | "timers" = $state("control");
    let isConnected = $state(false);

    function connectWebSocket() {
        const wsProtocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

        socket = new WebSocket(wsUrl);

        socket.onopen = () => (isConnected = true);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "presentation-update")
                presentationData = data.payload;
            if (data.type === "controls-update") controlsData = data.payload;
        };

        socket.onclose = () => {
            isConnected = false;
            setTimeout(connectWebSocket, 2000);
        };
    }

    onMount(() => {
        connectWebSocket();
        return () => socket?.close();
    });

    // Send command to the Axum Server -> Rust -> Tauri Desktop -> Layout.svelte
    function sendCommand(action: string, value?: any) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action, value }));
            // Haptic feedback for mobile devices!
            if (navigator.vibrate) navigator.vibrate(50);
        }
    }
</script>

<svelte:head>
    <title>WCP Remote</title>
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
</svelte:head>

<main
    class="h-screen w-screen bg-black text-white flex flex-col font-sans overflow-hidden select-none"
>
    <!-- Header -->
    <header
        class="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 shrink-0"
    >
        <div class="flex items-center gap-2">
            <div
                class="w-3 h-3 rounded-full {isConnected
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : 'bg-red-500'}"
            ></div>
            <span class="font-bold tracking-widest text-sm uppercase"
                >WCP Remote</span
            >
        </div>
        {#if presentationData?.liveReference}
            <span
                class="bg-zinc-800 px-3 py-1 rounded text-xs font-bold text-neon-cyan"
                >{presentationData.liveReference}</span
            >
        {/if}
    </header>

    <!-- LIVE PREVIEW AREA -->
    <div
        class="p-4 border-b border-zinc-800 bg-zinc-900/50 shrink-0 min-h-[100px] flex flex-col justify-center items-center text-center"
    >
        {#if presentationData?.liveText}
            <p class="text-xl font-bold line-clamp-3 text-zinc-100">
                {@html presentationData.liveText}
            </p>
        {:else}
            <p class="text-zinc-500 italic">No Active Text</p>
        {/if}
    </div>

    <!-- MAIN INTERFACE -->
    <div class="flex-1 flex flex-col overflow-hidden">
        {#if activeTab === "control"}
            <!-- LARGE TRANSPORT CONTROLS -->
            <div class="flex-1 flex flex-col p-4 gap-4">
                <button
                    class="flex-1 bg-zinc-900 active:bg-zinc-800 rounded-2xl border-2 border-zinc-800 flex flex-col items-center justify-center gap-2 text-zinc-400 transition-colors"
                    onclick={() => sendCommand("PREV_SLIDE")}
                >
                    <ChevronLeft size={48} />
                    <span class="font-bold tracking-widest uppercase"
                        >Previous</span
                    >
                </button>
                <button
                    class="flex-[2] bg-neon-violet/20 active:bg-neon-violet/40 rounded-2xl border-2 border-neon-violet flex flex-col items-center justify-center gap-2 text-white transition-colors shadow-[0_0_30px_rgba(139,92,246,0.15)]"
                    onclick={() => sendCommand("NEXT_SLIDE")}
                >
                    <ChevronRight size={64} />
                    <span class="font-bold tracking-widest text-xl uppercase"
                        >Next Slide</span
                    >
                </button>
            </div>

            <!-- EMERGENCY ACTIONS -->
            <div class="grid grid-cols-2 gap-4 p-4 pt-0 shrink-0">
                <button
                    class="py-4 bg-zinc-900 active:bg-zinc-800 rounded-xl border border-zinc-800 flex flex-col items-center gap-1 {presentationData?.isTextCleared
                        ? 'text-red-500 border-red-500/50'
                        : 'text-zinc-400'}"
                    onclick={() => sendCommand("CLEAR_TEXT")}
                >
                    <XSquare size={24} />
                    <span class="text-xs font-bold uppercase">Clear Text</span>
                </button>
                <button
                    class="py-4 bg-zinc-900 active:bg-zinc-800 rounded-xl border border-zinc-800 flex flex-col items-center gap-1 {presentationData?.isBlackout
                        ? 'text-red-500 border-red-500/50 bg-red-500/10'
                        : 'text-zinc-400'}"
                    onclick={() => sendCommand("BLACKOUT")}
                >
                    <MonitorX size={24} />
                    <span class="text-xs font-bold uppercase">Blackout</span>
                </button>
            </div>
        {:else if activeTab === "timers"}
            <!-- TIMER CONTROLS -->
            <div
                class="absolute inset-0 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300"
            >
                <Timers {controlsData} {sendCommand} />
            </div>
        {/if}
    </div>

    <!-- TABS -->
    <div class="flex bg-zinc-950 border-t border-zinc-800 shrink-0 pb-safe">
        <button
            class="flex-1 py-4 text-sm font-bold uppercase tracking-widest border-t-2 transition-colors {activeTab ===
            'control'
                ? 'border-neon-violet text-neon-violet bg-neon-violet/10'
                : 'border-transparent text-zinc-500'}"
            onclick={() => (activeTab = "control")}
        >
            Control
        </button>
        <button
            class="flex-1 py-4 text-sm font-bold uppercase tracking-widest border-t-2 transition-colors {activeTab ===
            'timers'
                ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                : 'border-transparent text-zinc-500'}"
            onclick={() => (activeTab = "timers")}
        >
            Timers
        </button>
    </div>
</main>
