<!-- src/lib/components/layout/display/StageDisplay.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import type { ExtendedPayload } from "./ProjectorDisplay.svelte";

    type StagePayload = ExtendedPayload & {
        stageShowClock?: boolean;
        stageShowNext?: boolean;

        stageMessage?: string;
        showMessageOnStage?: boolean;

        serviceTargetTimestamp?: number | null;
        showServiceTimerOnStage?: boolean;

        speakerTargetTimestamp?: number | null;
        speakerPausedRemainingMs?: number | null;
        showSpeakerTimerOnStage?: boolean;
    };

    let { display }: { display: StagePayload } = $props<{
        display: StagePayload;
    }>();

    // Convert formatting config to standard CSS variables for the Stage
    let styleString = $derived(`
            --font-family: "${display.stage?.textFormat?.fontFamily ?? "sans-serif"}", sans-serif;
            --text-transform: ${display.stage?.textFormat?.textTransform ?? "none"};
            --font-weight: ${display.stage?.textFormat?.fontWeight ?? "bold"};
            --letter-spacing: ${display.stage?.textFormat?.letterSpacing ?? 0}px;
            --line-height: ${display.stage?.textFormat?.lineHeight ?? 1.2};
            --text-align: ${display.stage?.textFormat?.textAlign ?? "center"};
            --stroke-width: ${display.stage?.textFormat?.textStrokeWidth ?? 0}px;
            --stroke-color: ${display.stage?.textFormat?.textStrokeColor ?? "#000000"};
            --font-scale: ${(display.stage?.textScale ?? 1) * (display.stage?.textFormat?.fontSizeScale ?? 1)};
            --drop-shadow: ${display.stage?.textFormat?.dropShadow ? "drop-shadow(0 4px 6px rgba(0,0,0,0.8))" : "none"};
        `);

    // Dynamic horizontal alignment mapping
    let horizontalAlignmentClass = $derived.by(() => {
        switch (display.stage?.textFormat?.textAlign) {
            case "left":
                return "items-start";
            case "right":
                return "items-end";
            case "center":
            default:
                return "items-center";
        }
    });

    let verticalAlignmentClass = $derived.by(() => {
        switch (display.stage?.textVAlign) {
            case "top":
                return "justify-start pt-[4cqh]";
            case "bottom":
                return "justify-end pb-[4cqh]";
            case "middle":
            default:
                return "justify-center";
        }
    });

    let clockInterval: ReturnType<typeof setInterval>;

    // Local state for ticking elements
    let currentTime = $state("");
    let serviceTimerText = $state<string | null>(null);
    let speakerTimerText = $state<string | null>(null);
    let isSpeakerOverrun = $state(false);

    function formatTime(ms: number) {
        const totalSeconds = Math.floor(Math.abs(ms) / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        let formatted = "";
        if (h > 0) formatted += `${h.toString().padStart(2, "0")}:`;
        formatted += `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        return ms < 0 ? `-${formatted}` : formatted;
    }

    function tick() {
        const now = Date.now();

        // 1. Clock
        currentTime = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });

        // 2. Service Timer
        if (display.serviceTargetTimestamp) {
            const diff = display.serviceTargetTimestamp - now;
            serviceTimerText = diff <= 0 ? "00:00" : formatTime(diff);
        } else {
            serviceTimerText = null;
        }

        // 3. Speaker Timer
        if (
            display.speakerTargetTimestamp !== null &&
            display.speakerTargetTimestamp !== undefined
        ) {
            const diff = display.speakerTargetTimestamp - now;
            isSpeakerOverrun = diff < 0;
            speakerTimerText = formatTime(diff);
        } else if (
            display.speakerPausedRemainingMs !== null &&
            display.speakerPausedRemainingMs !== undefined
        ) {
            isSpeakerOverrun = display.speakerPausedRemainingMs < 0;
            speakerTimerText = formatTime(display.speakerPausedRemainingMs);
        } else {
            speakerTimerText = null;
            isSpeakerOverrun = false;
        }
    }

    onMount(() => {
        tick(); // Initial tick
        clockInterval = setInterval(tick, 200); // 200ms for accurate timer ticking
    });

    onDestroy(() => clearInterval(clockInterval));

    function getLiveTextScaleClass(text: string | undefined): string {
        if (!text) return "text-scale-base";
        const chars = text.length;
        const lines = text.split("\n").length;

        if (lines <= 2 && chars < 60) return "text-scale-huge";
        if (lines <= 4 && chars < 150) return "text-scale-large";
        if (lines <= 6 && chars < 250) return "text-scale-medium";
        return "text-scale-base";
    }
</script>

<div
    class="stage-container absolute inset-0 overflow-hidden bg-black text-white flex flex-col transition-opacity duration-300 select-none"
    class:opacity-0={display.isBlackout}
    style={styleString}
>
    <!-- Header / Info Bar -->
    <header
        class="cq-header border-b border-zinc-800 flex items-center justify-between cq-px bg-zinc-950 flex-shrink-0 z-20 font-sans"
    >
        <div class="flex items-center justify-between cq-gap">
            <span
                class="cq-badge bg-red-600/20 text-red-500 font-bold tracking-widest uppercase rounded-sm border border-red-600/30"
            >
                Live
            </span>
            {#if display.liveReference}
                <span
                    class="stage-reference cq-label-next-right text-yellow-300 font-black drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-widest z-10"
                >
                    {display.liveReference}
                </span>
            {/if}
        </div>

        <div class="absolute right-[4cqw] z-40 flex items-center gap-[4cqw]">
            {#if display.showServiceTimerOnStage && serviceTimerText}
                <div class="flex flex-col items-end drop-shadow-xl">
                    <span
                        class="text-[5cqh] font-black tabular-nums text-white leading-none"
                        >{serviceTimerText}</span
                    >
                </div>
            {/if}

            {#if display.showSpeakerTimerOnStage && speakerTimerText}
                <div
                    class="flex flex-col items-end drop-shadow-xl bg-black/40 px-[2cqw] py-[1cqh] rounded-xl backdrop-blur-md border border-white/10"
                >
                    <span
                        class="text-[8cqh] font-black tabular-nums leading-none {isSpeakerOverrun
                            ? 'text-red-500 animate-pulse'
                            : 'text-emerald-400'}"
                    >
                        {speakerTimerText}
                    </span>
                </div>
            {:else}
                <div class="flex items-center gap-8 md:gap-16">
                    {#if display.stageShowClock !== false}
                        <div
                            class="cq-text-time font-black tracking-tight text-white font-mono"
                        >
                            {currentTime}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </header>

    <!-- Stage Message Overlay Banner -->
    {#if display.showMessageOnStage && display.stageMessage}
        <div
            class="absolute top-[14cqh] inset-x-0 z-50 bg-red-600 border-b-[1cqh] border-red-800 text-white py-[4cqh] px-[5cqw] shadow-2xl flex items-center justify-center animate-in slide-in-from-top-full duration-300 font-sans"
        >
            <span
                class="text-[6cqh] font-black uppercase tracking-widest text-center animate-pulse"
                >{display.stageMessage}</span
            >
        </div>
    {/if}

    <!-- Display Area -->
    <div class="flex-1 flex flex-col min-h-0 relative z-10">
        <!-- CURRENT SLIDE -->
        <div
            class="transition-all duration-300 border-b border-zinc-800 cq-p flex flex-col relative bg-black {display.stageShowNext ===
            false
                ? 'flex-1'
                : 'flex-[5]'}"
        >
            <div
                class="live-text-container flex-1 w-full h-full flex {horizontalAlignmentClass} {verticalAlignmentClass} px-4 md:px-12 relative"
            >
                <!-- Foreground Media on Stage -->
                {#if display.liveMedia}
                    {#if display.liveMedia.type === "video"}
                        <video
                            src={display.liveMedia.url}
                            autoplay
                            muted
                            class="absolute inset-0 w-full h-full object-contain opacity-40"
                        ></video>
                    {:else}
                        <img
                            src={display.liveMedia.url}
                            alt="Media"
                            class="absolute inset-0 w-full h-full object-contain opacity-40"
                        />
                    {/if}
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center z-10 font-sans"
                    >
                        <span
                            class="bg-black/80 text-neon-cyan px-6 py-3 rounded-xl border border-neon-cyan/30 font-black uppercase tracking-[0.2em] cq-text-media-badge shadow-2xl"
                        >
                            Now Showing Media
                        </span>
                    </div>
                {:else if display.liveText}
                    <p
                        class="stage-slide-text text-white transition-all whitespace-pre-wrap duration-300 w-full relative z-10 {getLiveTextScaleClass(
                            display.liveText,
                        )}"
                    >
                        {display.liveText}
                    </p>
                {:else}
                    <span
                        class="text-zinc-800 font-mono tracking-widest cq-text-empty font-bold uppercase relative z-10"
                    >
                    </span>
                {/if}
            </div>
        </div>

        <!-- NEXT SLIDE -->
        {#if display.stageShowNext !== false}
            <div
                class="flex-[2] cq-p flex flex-col relative bg-zinc-900/50 animate-in slide-in-from-bottom-4 z-20"
            >
                <div
                    class="next-text-container flex-1 w-full flex {horizontalAlignmentClass} justify-center px-8"
                >
                    {#if display.nextText}
                        <p
                            class="stage-next-text cq-text-next text-zinc-400 line-clamp-3 w-full whitespace-pre-wrap"
                        >
                            {display.nextText}
                        </p>
                    {:else}
                        <span
                            class="text-zinc-800/50 font-mono tracking-widest cq-text-empty font-bold uppercase"
                        >
                            [ End of Section ]
                        </span>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .stage-container {
        container-type: size;
    }

    .stage-slide-text {
        font-family: var(--font-family);
        text-transform: var(--text-transform);
        font-weight: var(--font-weight);
        letter-spacing: var(--letter-spacing);
        line-height: var(--line-height);
        text-align: var(--text-align);

        -webkit-text-stroke: var(--stroke-width) var(--stroke-color);
        paint-order: stroke fill;
        filter: var(--drop-shadow);
    }

    .stage-next-text {
        font-family: var(--font-family);
        text-transform: var(--text-transform);
        font-weight: var(--font-weight);
        text-align: var(--text-align);
        letter-spacing: var(--letter-spacing);
    }

    .stage-reference {
        font-family: var(--font-family);
    }

    .cq-header {
        height: 14cqh;
    }
    .cq-px {
        padding-left: 4cqw;
        padding-right: 4cqw;
    }
    .cq-p {
        padding: 4cqw;
    }
    .cq-gap {
        gap: 1cqw;
    }
    .cq-badge {
        font-size: 1.5cqw;
        padding: 0.5cqh 1.5cqw;
    }
    .cq-text-time {
        font-size: 4cqw;
        line-height: 1;
        text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }
    .cq-label-next-right {
        font-size: 4cqw;
        top: 2cqh;
        right: 3cqw;
    }
    .live-text-container,
    .next-text-container {
        container-type: size;
    }

    /* Using the combined font-scale variable for dynamic sizing */
    .text-scale-huge {
        font-size: calc(min(8.5cqw, 35cqh) * var(--font-scale, 1));
    }
    .text-scale-large {
        font-size: calc(min(6.5cqw, 22cqh) * var(--font-scale, 1));
    }
    .text-scale-medium {
        font-size: calc(min(5cqw, 15cqh) * var(--font-scale, 1));
    }
    .text-scale-base {
        font-size: calc(min(4cqw, 11cqh) * var(--font-scale, 1));
    }
    .cq-text-next {
        font-size: calc(min(10cqw, 40cqh) * var(--font-scale, 1) * 0.75);
    }
</style>
