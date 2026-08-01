<!-- src/lib/components/layout/controlpanel/tabs/ControlsTab.svelte -->
<script lang="ts">
    import { controlsState } from "$lib/state/controls.svelte";
    import {
        Play,
        Pause,
        RotateCcw,
        Monitor,
        Projector,
        MessageSquare,
        Clock,
        Plus,
        Minus,
        Send,
        X,
    } from "@lucide/svelte";

    let stageMessageInput = $state("");
    let speakerMinutesInput = $state(50);
    let serviceTimeInput = $state("09:00");

    // --- New Speaker Timer Adjustment State ---
    let adjustmentInput = $state(5); // Default to 5 minutes
    let pendingAdjustment = $state<number | null>(null);
    let adjustmentTimeout: ReturnType<typeof setTimeout>;

    // --- Message Handlers ---
    function handleSendMessage() {
        if (stageMessageInput.trim()) {
            controlsState.setStageMessage(stageMessageInput.trim());
            controlsState.showMessageOnStage = true;
            controlsState.broadcastControls();
        }
    }

    function handleClearMessage() {
        controlsState.clearStageMessage();
        stageMessageInput = "";
    }

    // --- Service Timer Handler ---
    function handleStartServiceTimer() {
        const [hours, minutes] = serviceTimeInput.split(":").map(Number);
        const targetDate = new Date();
        targetDate.setHours(hours, minutes, 0, 0);

        if (targetDate.getTime() < Date.now()) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        controlsState.startServiceTimer(targetDate);
    }

    // --- Speaker Timer Adjustment Handlers ---
    function initiateAdjustment(amount: number) {
        pendingAdjustment = amount;
        clearTimeout(adjustmentTimeout);
        // Auto-cancel if the operator doesn't confirm within 5 seconds
        adjustmentTimeout = setTimeout(() => {
            pendingAdjustment = null;
        }, 5000);
    }

    function confirmAdjustment() {
        if (pendingAdjustment !== null) {
            controlsState.adjustSpeakerTimer(pendingAdjustment);
            pendingAdjustment = null;
            clearTimeout(adjustmentTimeout);
        }
    }

    function cancelAdjustment() {
        pendingAdjustment = null;
        clearTimeout(adjustmentTimeout);
    }
</script>

<div
    class="flex-1 overflow-y-auto flex flex-col pr-1 gap-4 pb-12 scrollbar-none"
>
    <!-- 1. MESSAGE CARD (Unchanged) -->
    <div
        class="bg-background/50 border border-border rounded-xl p-3 flex flex-col gap-3"
    >
        <!-- ... (Keep your existing message card code here) ... -->
        <div class="flex items-center gap-2 text-muted-foreground">
            <MessageSquare size={16} />
            <span class="text-xs font-bold uppercase tracking-wider"
                >Alert Message</span
            >
            {#if controlsState.isMessageActive}
                <span
                    class="ml-auto flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"
                ></span>
            {/if}
        </div>

        <div class="flex flex-col gap-2">
            <input
                type="text"
                bind:value={stageMessageInput}
                placeholder="Type alert message..."
                class="w-full bg-zinc-900 border border-border rounded-md px-3 py-2 text-sm focus:border-neon-cyan outline-none text-foreground transition-colors"
                onkeydown={(e) => e.key === "Enter" && handleSendMessage()}
            />

            <div class="flex gap-2">
                {#if controlsState.isMessageActive}
                    <button
                        onclick={handleClearMessage}
                        class="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-md py-1.5 text-xs font-semibold transition-colors"
                    >
                        <X size={14} /> Clear Alert
                    </button>
                {:else}
                    <button
                        onclick={handleSendMessage}
                        class="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-foreground border border-zinc-700 rounded-md py-1.5 text-xs font-semibold transition-colors"
                    >
                        <Send size={14} /> Set Message
                    </button>
                {/if}
            </div>

            {#if controlsState.stageMessage || controlsState.isMessageActive}
                <div class="flex items-center gap-2 mt-1">
                    <button
                        onclick={() => controlsState.toggleMessageStage()}
                        class="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all border {controlsState.showMessageOnStage
                            ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 shadow-sm'
                            : 'bg-zinc-900/50 border-zinc-800 text-muted-foreground hover:text-foreground'}"
                    >
                        <Monitor size={12} /> Stage
                    </button>
                    <button
                        onclick={() => controlsState.toggleMessageProjector()}
                        class="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all border {controlsState.showMessageOnProjector
                            ? 'bg-neon-violet/10 text-neon-violet border-neon-violet/30 shadow-sm'
                            : 'bg-zinc-900/50 border-zinc-800 text-muted-foreground hover:text-foreground'}"
                    >
                        <Projector size={12} /> Projector
                    </button>
                </div>
            {/if}
        </div>
    </div>

    <!-- 2. SPEAKER TIMER CARD (UPDATED) -->
    <div
        class="bg-background/50 border border-border rounded-xl p-3 flex flex-col gap-3"
    >
        <div class="flex items-center gap-2 text-muted-foreground">
            <Clock size={16} class="text-emerald-400" />
            <span
                class="text-xs font-bold uppercase tracking-wider text-emerald-400"
                >Speaker Timer</span
            >
        </div>

        <div class="flex items-center gap-3">
            <!-- Base duration is locked out while timer is running/paused to prevent accidental overwrites -->
            <input
                type="number"
                bind:value={speakerMinutesInput}
                onchange={() =>
                    controlsState.setSpeakerDuration(speakerMinutesInput)}
                disabled={controlsState.isSpeakerTimerRunning ||
                    controlsState.speakerPausedRemainingMs !== null}
                class="w-16 bg-zinc-900 border border-border rounded-md px-2 py-1.5 text-center text-sm focus:border-emerald-400 outline-none text-foreground tabular-nums font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                min="1"
            />
            <span class="text-xs text-muted-foreground uppercase font-semibold"
                >Mins</span
            >

            <!-- Live Adjustment UI -->
            <div
                class="ml-auto flex items-center bg-zinc-900 rounded-md border border-border p-0.5"
            >
                {#if pendingAdjustment !== null}
                    <button
                        onclick={confirmAdjustment}
                        class="px-2 py-1 bg-amber-500/20 text-amber-500 rounded text-xs font-bold transition-colors flex items-center gap-1"
                    >
                        Confirm {pendingAdjustment > 0
                            ? "+"
                            : ""}{pendingAdjustment}m
                    </button>
                    <button
                        onclick={cancelAdjustment}
                        class="p-1 hover:bg-zinc-800 text-muted-foreground hover:text-foreground rounded transition-colors"
                    >
                        <X size={14} />
                    </button>
                {:else}
                    <button
                        onclick={() => initiateAdjustment(-adjustmentInput)}
                        class="p-1 hover:bg-zinc-800 rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Subtract Time"
                    >
                        <Minus size={14} />
                    </button>
                    <input
                        type="number"
                        bind:value={adjustmentInput}
                        class="w-9 bg-transparent text-center text-xs outline-none text-foreground tabular-nums font-bold border-x border-border/50 mx-0.5"
                        min="1"
                    />
                    <button
                        onclick={() => initiateAdjustment(adjustmentInput)}
                        class="p-1 hover:bg-zinc-800 rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Add Time"
                    >
                        <Plus size={14} />
                    </button>
                {/if}
            </div>
        </div>

        <!-- Start/Pause/Reset Controls -->
        <div class="flex gap-2">
            {#if controlsState.isSpeakerTimerRunning}
                <button
                    onclick={() => {
                        controlsState.pauseSpeakerTimer();
                        cancelAdjustment();
                    }}
                    class="flex-1 flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-md py-1.5 text-xs font-semibold transition-colors"
                    ><Pause size={14} /> Pause</button
                >
            {:else}
                <button
                    onclick={() => controlsState.startSpeakerTimer()}
                    class="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-md py-1.5 text-xs font-semibold transition-colors"
                    ><Play size={14} />
                    {controlsState.speakerPausedRemainingMs
                        ? "Resume"
                        : "Start"}
                </button>
            {/if}
            <button
                onclick={() => {
                    controlsState.resetSpeakerTimer();
                    cancelAdjustment();
                }}
                class="px-3 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                title="Reset Timer"><RotateCcw size={14} /></button
            >
        </div>

        <!-- Routing Toggles -->
        {#if controlsState.isSpeakerTimerRunning || controlsState.speakerPausedRemainingMs !== null}
            <div class="flex items-center gap-2 mt-1">
                <button
                    onclick={() => controlsState.toggleSpeakerTimerStage()}
                    class="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all border {controlsState.showSpeakerTimerOnStage
                        ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 shadow-sm'
                        : 'bg-zinc-900/50 border-zinc-800 text-muted-foreground hover:text-foreground'}"
                >
                    <Monitor size={12} /> Stage
                </button>
                <button
                    onclick={() => controlsState.toggleSpeakerTimerProjector()}
                    class="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all border {controlsState.showSpeakerTimerOnProjector
                        ? 'bg-neon-violet/10 text-neon-violet border-neon-violet/30 shadow-sm'
                        : 'bg-zinc-900/50 border-zinc-800 text-muted-foreground hover:text-foreground'}"
                >
                    <Projector size={12} /> Projector
                </button>
            </div>
        {/if}
    </div>

    <!-- 3. SERVICE COUNTDOWN CARD (Unchanged) -->
    <div
        class="bg-background/50 border border-border rounded-xl p-3 flex flex-col gap-3"
    >
        <!-- ... (Keep your existing service card code here) ... -->
        <div class="flex items-center gap-2 text-muted-foreground">
            <Clock size={16} class="text-neon-violet" />
            <span
                class="text-xs font-bold uppercase tracking-wider text-neon-violet"
                >Service Target</span
            >
        </div>

        <div class="flex items-center gap-3">
            <input
                type="time"
                bind:value={serviceTimeInput}
                class="flex-1 bg-zinc-900 border border-border rounded-md px-3 py-1.5 text-sm focus:border-neon-violet outline-none text-foreground tabular-nums font-bold"
            />
            {#if controlsState.isServiceTimerActive}
                <button
                    onclick={() => controlsState.stopServiceTimer()}
                    class="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-md text-xs font-semibold transition-colors"
                    >Stop</button
                >
            {:else}
                <button
                    onclick={handleStartServiceTimer}
                    class="px-4 py-1.5 bg-neon-violet/10 hover:bg-neon-violet/20 text-neon-violet border border-neon-violet/20 rounded-md text-xs font-semibold transition-colors"
                    >Start</button
                >
            {/if}
        </div>

        {#if controlsState.isServiceTimerActive}
            <div class="flex items-center gap-2 mt-1">
                <button
                    onclick={() => controlsState.toggleServiceTimerStage()}
                    class="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all border {controlsState.showServiceTimerOnStage
                        ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 shadow-sm'
                        : 'bg-zinc-900/50 border-zinc-800 text-muted-foreground hover:text-foreground'}"
                >
                    <Monitor size={12} /> Stage
                </button>
                <button
                    onclick={() => controlsState.toggleServiceTimerProjector()}
                    class="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all border {controlsState.showServiceTimerOnProjector
                        ? 'bg-neon-violet/10 text-neon-violet border-neon-violet/30 shadow-sm'
                        : 'bg-zinc-900/50 border-zinc-800 text-muted-foreground hover:text-foreground'}"
                >
                    <Projector size={12} /> Projector
                </button>
            </div>
        {/if}
    </div>
</div>
