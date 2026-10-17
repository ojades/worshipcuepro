<!-- /src/routes/remote/components/timers.svelte -->
<script lang="ts">
    import {
        Clock,
        Play,
        Pause,
        RotateCcw,
        Plus,
        Minus,
        Delete,
    } from "@lucide/svelte";
    import { onMount, onDestroy, untrack } from "svelte";

    let { controlsData, sendCommand } = $props<{
        controlsData: any;
        sendCommand: (action: string, value?: any) => void;
    }>();

    // Local inputs for setting new timers
    let manualSpeakerMinutes = $state(50);
    let isEditingSpeaker = $state(false);

    // Custom Keypad State
    let isKeypadOpen = $state(false);
    let keypadValue = $state("");

    let serviceTimeInput = $state("12:00");
    let timerInterval: ReturnType<typeof setInterval>;

    // Live display state
    let speakerTimerDisplay = $state("--:--");
    let serviceTimerDisplay = $state("--:--");
    let isSpeakerOverrun = $state(false);

    let localServiceTargetTimestamp = $state<number | null>(null);
    let localSpeakerTargetTimestamp = $state<number | null>(null);
    let speakerPausedRemainingMs = $state<number | null>(null);

    // Reactively freeze local absolute targets when new data arrives from the network
    $effect(() => {
        if (!controlsData) return;
        const now = Date.now();

        if (controlsData.speakerTotalDurationMs) {
            const incomingMinutes = Math.round(
                controlsData.speakerTotalDurationMs / 60000,
            );

            untrack(() => {
                // Only sync the network value if the user isn't actively typing in the box
                if (
                    manualSpeakerMinutes !== incomingMinutes &&
                    !isEditingSpeaker
                ) {
                    manualSpeakerMinutes = incomingMinutes;
                }
            });
        }

        // Handle Service Timer
        if (
            controlsData.serviceRemainingMs !== null &&
            controlsData.serviceRemainingMs !== undefined
        ) {
            localServiceTargetTimestamp = now + controlsData.serviceRemainingMs;
        } else {
            localServiceTargetTimestamp = null;
        }

        // Handle Speaker Timer
        if (
            controlsData.isSpeakerRunning &&
            controlsData.speakerRemainingMs !== null &&
            controlsData.speakerRemainingMs !== undefined
        ) {
            localSpeakerTargetTimestamp = now + controlsData.speakerRemainingMs;
            speakerPausedRemainingMs = null;
        } else if (
            !controlsData.isSpeakerRunning &&
            controlsData.speakerRemainingMs !== null &&
            controlsData.speakerRemainingMs !== undefined
        ) {
            localSpeakerTargetTimestamp = null;
            speakerPausedRemainingMs = controlsData.speakerRemainingMs;
        } else {
            localSpeakerTargetTimestamp = null;
            speakerPausedRemainingMs = null;
        }
    });

    function formatTime(ms: number) {
        const totalSeconds = Math.floor(Math.abs(ms) / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        let formatted = h > 0 ? `${h.toString().padStart(2, "0")}:` : "";
        formatted += `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        return ms < 0 ? `-${formatted}` : formatted;
    }

    function tick() {
        const now = Date.now();

        // Service Timer
        if (localServiceTargetTimestamp !== null) {
            const diff = localServiceTargetTimestamp - now;
            serviceTimerDisplay = diff <= 0 ? "00:00" : formatTime(diff);
        } else {
            serviceTimerDisplay = "--:--";
        }

        // Speaker Timer
        if (localSpeakerTargetTimestamp !== null) {
            const diff = localSpeakerTargetTimestamp - now;
            isSpeakerOverrun = diff < 0;
            speakerTimerDisplay = formatTime(diff);
        } else if (speakerPausedRemainingMs !== null) {
            isSpeakerOverrun = speakerPausedRemainingMs < 0;
            speakerTimerDisplay = formatTime(speakerPausedRemainingMs);
        } else {
            speakerTimerDisplay = formatTime(manualSpeakerMinutes * 60000);
            isSpeakerOverrun = false;
        }
    }

    onMount(() => {
        tick();
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

        sendCommand("START_SERVICE_TIMER", targetDate.getTime());
    }

    function handleStopService() {
        sendCommand("STOP_SERVICE_TIMER");
    }

    function setSpeakerDuration() {
        sendCommand("SET_SPEAKER_DURATION", manualSpeakerMinutes);
    }

    // --- Keypad Logic ---
    function openKeypad() {
        if (
            localSpeakerTargetTimestamp !== null ||
            speakerPausedRemainingMs !== null
        )
            return;
        isEditingSpeaker = true;
        keypadValue = manualSpeakerMinutes.toString();
        isKeypadOpen = true;
    }

    function closeKeypad() {
        isKeypadOpen = false;
        isEditingSpeaker = false;
    }

    function keypadPress(key: string) {
        if (navigator.vibrate) navigator.vibrate(20);
        // Limit to 3 digits (max 999 mins)
        if (keypadValue.length < 3) {
            if (keypadValue === "0") keypadValue = key;
            else keypadValue += key;
        }
    }

    function keypadBackspace() {
        if (navigator.vibrate) navigator.vibrate(20);
        keypadValue = keypadValue.slice(0, -1);
        if (keypadValue === "") keypadValue = "0";
    }

    function applyKeypad() {
        if (navigator.vibrate) navigator.vibrate(40);
        const val = parseInt(keypadValue, 10);
        if (!isNaN(val) && val > 0) {
            manualSpeakerMinutes = val;
            setSpeakerDuration();
        }
        closeKeypad();
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
                <!-- FIXED: Replaced native input with a trigger button -->
                <button
                    onclick={openKeypad}
                    disabled={localSpeakerTargetTimestamp !== null ||
                        speakerPausedRemainingMs !== null}
                    class="w-12 bg-transparent text-center text-sm outline-none text-white font-bold disabled:opacity-50 py-0.5"
                >
                    {manualSpeakerMinutes}
                </button>
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
        <!-- ... [Service Timer code remains exactly the same] ... -->
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
            {#if localServiceTargetTimestamp !== null}
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

<!-- KEYPAD MODAL OVERLAY -->
{#if isKeypadOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onclick={closeKeypad}
    >
        <div
            class="bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-6 pb-10 shadow-2xl flex flex-col gap-6 w-full slide-in-from-bottom-full animate-in duration-300"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Header -->
            <div class="flex justify-between items-center">
                <h3
                    class="text-zinc-500 font-bold uppercase tracking-widest text-xs"
                >
                    Set Speaker Minutes
                </h3>
                <button
                    onclick={closeKeypad}
                    class="text-zinc-400 hover:text-white font-medium transition-colors"
                >
                    Cancel
                </button>
            </div>

            <!-- Display -->
            <div
                class="text-center text-6xl font-black text-white tabular-nums border-b border-zinc-800/50 pb-4 tracking-tighter"
            >
                {keypadValue || "0"}<span
                    class="text-xl text-zinc-500 ml-2 font-bold tracking-widest uppercase"
                    >Min</span
                >
            </div>

            <!-- Numpad Grid -->
            <div class="grid grid-cols-3 gap-3">
                {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as num}
                    <button
                        onclick={() => keypadPress(num.toString())}
                        class="py-4 bg-zinc-900 active:bg-zinc-800 rounded-2xl text-2xl font-bold text-zinc-100 transition-colors border border-zinc-800/50 shadow-sm"
                    >
                        {num}
                    </button>
                {/each}
                <div class="col-start-1"></div>
                <button
                    onclick={() => keypadPress("0")}
                    class="py-4 bg-zinc-900 active:bg-zinc-800 rounded-2xl text-2xl font-bold text-zinc-100 transition-colors border border-zinc-800/50 shadow-sm"
                >
                    0
                </button>
                <button
                    onclick={keypadBackspace}
                    class="py-4 bg-zinc-900 active:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 transition-colors border border-zinc-800/50 shadow-sm"
                >
                    <Delete size={28} />
                </button>
            </div>

            <!-- Apply Button -->
            <button
                onclick={applyKeypad}
                class="w-full mt-2 py-4 bg-neon-violet text-white font-bold text-lg tracking-wide rounded-2xl shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-[0.98] transition-transform"
            >
                Set Timer
            </button>
        </div>
    </div>
{/if}
