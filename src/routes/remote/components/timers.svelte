<!-- /src/routes/remote/components/timers.svelte -->
<script lang="ts">
    import { Clock, Play, Pause, RotateCcw, Plus, Minus } from "@lucide/svelte";
    import { onMount, onDestroy } from "svelte";

    let { controlsData, sendCommand } = $props<{
        controlsData: any;
        sendCommand: (action: string, value?: any) => void;
    }>();

    // Local inputs for setting new timers
    let manualSpeakerMinutes = $state(50);
    let serviceTimeInput = $state("12:00");
    let timerInterval: ReturnType<typeof setInterval>;

    // Live display state
    let speakerTimerDisplay = $state("--:--");
    let serviceTimerDisplay = $state("--:--");
    let isSpeakerOverrun = $state(false);

    function formatTime(ms: number) {
        const totalSeconds = Math.floor(Math.abs(ms) / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        let formatted = h > 0 ? `${h.toString().padStart(2, "0")}:` : "";
        formatted += `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        return ms < 0 ? `-${formatted}` : formatted;
    }

    // This loop allows the mobile app to show the actual countdown locally
    // without needing constant WebSocket blasts.
    function tick() {
        if (!controlsData) return;
        const now = Date.now();

        // Service Timer
        if (
            controlsData.serviceRemainingMs !== null &&
            controlsData.serviceRemainingMs !== undefined
        ) {
            // We use the last received remaining Ms to calculate a local target
            // (Assuming payload arrived very recently. For a remote, this is usually acceptable).
            const diff = controlsData.serviceRemainingMs;
            serviceTimerDisplay = diff <= 0 ? "00:00" : formatTime(diff);

            // To make it tick locally between websocket updates:
            // Decrease the stored remaining time by 200ms every tick
            controlsData.serviceRemainingMs -= 200;
        } else {
            serviceTimerDisplay = "--:--";
        }

        // Speaker Timer
        if (
            controlsData.isSpeakerRunning &&
            controlsData.speakerRemainingMs !== null
        ) {
            const diff = controlsData.speakerRemainingMs;
            isSpeakerOverrun = diff < 0;
            speakerTimerDisplay = formatTime(diff);
            controlsData.speakerRemainingMs -= 200;
        } else if (
            !controlsData.isSpeakerRunning &&
            controlsData.speakerRemainingMs !== null
        ) {
            isSpeakerOverrun = controlsData.speakerRemainingMs < 0;
            speakerTimerDisplay = formatTime(controlsData.speakerRemainingMs);
        } else {
            speakerTimerDisplay = formatTime(manualSpeakerMinutes * 60000);
            isSpeakerOverrun = false;
        }
    }

    onMount(() => {
        timerInterval = setInterval(tick, 200);
        return () => clearInterval(timerInterval);
    });

    // --- Actions ---
    function handleStartService() {
        const [hours, minutes] = serviceTimeInput.split(":").map(Number);
        const targetDate = new Date();
        targetDate.setHours(hours, minutes, 0, 0);

        if (targetDate.getTime() < Date.now()) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        // Pass the absolute timestamp so the backend can sync it globally
        sendCommand("START_SERVICE_TIMER", targetDate.getTime());
    }

    function handleStopService() {
        sendCommand("STOP_SERVICE_TIMER");
    }

    function setSpeakerDuration() {
        sendCommand("SET_SPEAKER_DURATION", manualSpeakerMinutes);
    }
</script>

<div
    class="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar pb-10"
>
    <!-- SPEAKER TIMER SECTION -->
    <div
        class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center gap-5 shadow-lg"
    >
        <div class="w-full flex items-center justify-between">
            <h2
                class="text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-2 text-sm"
            >
                <Clock size={16} /> Speaker
            </h2>
            <div
                class="flex items-center gap-1 bg-zinc-950 rounded-lg p-1 border border-zinc-800"
            >
                <input
                    type="number"
                    bind:value={manualSpeakerMinutes}
                    onchange={setSpeakerDuration}
                    disabled={controlsData?.isSpeakerRunning}
                    class="w-10 bg-transparent text-center text-sm outline-none text-white font-bold disabled:opacity-50"
                    min="1"
                />
                <span class="text-[10px] text-zinc-500 font-bold pr-1">MIN</span
                >
            </div>
        </div>

        <div class="flex justify-center items-center gap-4 w-full">
            <button
                onclick={() => sendCommand("ADJUST_SPEAKER_TIMER", -1)}
                class="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300 active:bg-zinc-700 transition-colors"
            >
                <Minus size={20} />
            </button>
            <div
                class="flex-1 text-center text-5xl font-black tabular-nums tracking-tighter {isSpeakerOverrun
                    ? 'text-red-500 animate-pulse'
                    : 'text-white'}"
            >
                {speakerTimerDisplay}
            </div>
            <button
                onclick={() => sendCommand("ADJUST_SPEAKER_TIMER", 1)}
                class="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300 active:bg-zinc-700 transition-colors"
            >
                <Plus size={20} />
            </button>
        </div>

        <div class="flex gap-3 w-full mt-2">
            <button
                onclick={() => sendCommand("TOGGLE_SPEAKER_TIMER")}
                class="flex-1 py-3 bg-emerald-500/20 text-emerald-500 active:bg-emerald-500/30 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors border border-emerald-500/30"
            >
                {#if controlsData?.isSpeakerRunning}
                    <Pause size={18} /> Pause
                {:else}
                    <Play size={18} /> Start
                {/if}
            </button>
            <button
                onclick={() => sendCommand("RESET_SPEAKER_TIMER")}
                class="px-5 bg-zinc-800 text-zinc-300 active:bg-zinc-700 rounded-xl font-bold transition-colors border border-zinc-700"
            >
                <RotateCcw size={18} />
            </button>
        </div>
    </div>

    <!-- SERVICE TIMER SECTION -->
    <div
        class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center gap-5 shadow-lg"
    >
        <div class="w-full flex items-center justify-between">
            <h2
                class="text-neon-violet font-bold uppercase tracking-widest flex items-center gap-2 text-sm"
            >
                <Clock size={16} /> Service
            </h2>
            <div
                class="flex items-center gap-1 bg-zinc-950 rounded-lg border border-zinc-800 pr-1 overflow-hidden"
            >
                <input
                    type="time"
                    bind:value={serviceTimeInput}
                    class="bg-transparent text-center text-sm outline-none text-white font-bold px-2 py-1"
                />
            </div>
        </div>

        <div class="w-full flex justify-center py-2">
            <div
                class="text-center text-5xl font-black tabular-nums tracking-tighter text-white"
            >
                {serviceTimerDisplay}
            </div>
        </div>

        <div class="w-full mt-2">
            {#if controlsData?.serviceRemainingMs !== null && controlsData?.serviceRemainingMs !== undefined}
                <button
                    onclick={handleStopService}
                    class="w-full py-3 bg-red-500/20 text-red-500 active:bg-red-500/30 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors border border-red-500/30"
                >
                    Stop Service Timer
                </button>
            {:else}
                <button
                    onclick={handleStartService}
                    class="w-full py-3 bg-neon-violet/20 text-neon-violet active:bg-neon-violet/30 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors border border-neon-violet/30"
                >
                    <Play size={18} /> Start Target Time
                </button>
            {/if}
        </div>
    </div>
</div>
