<!-- src/lib/components/layout/display/StageDisplay.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { ExtendedPayload } from "./ProjectorDisplay.svelte";
    import { LOADING_SLIDE_TEXT } from "$lib/types/models";

    type StagePayload = ExtendedPayload & {
        stageShowClock?: boolean;
        stageShowNext?: boolean;

        stageMessage?: string;
        showMessageOnStage?: boolean;

        serviceTargetTimestamp?: number | null;
        showServiceTimerOnStage?: boolean;

        speakerTargetTimestamp?: number | null;
        speakerPausedRemainingMs?: number | null;
        speakerTotalDurationMs?: number | null;
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
            --v-gap: ${display.stage?.vGap ?? 0}cqh;

            --ref-font-family: "${display.stage?.textFormat?.referenceFontFamily ?? display.stage?.textFormat?.fontFamily ?? "sans-serif"}", sans-serif;
            --ref-font-weight: ${display.stage?.textFormat?.referenceFontWeight ?? "bold"};
            --ref-text-transform: ${display.stage?.textFormat?.referenceTextTransform ?? "none"};
            --ref-font-scale: ${(display.stage?.textScale ?? 1) * (display.stage?.textFormat?.referenceFontSizeScale ?? 1)};
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
                return "justify-start cq-pt";
            case "bottom":
                return "justify-end cq-pb";
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
    let speakerTimerColorClass = $state("text-emerald-400");
    let isSpeakerOverrun = $state(false);
    let bgVideoNode: HTMLVideoElement | null = $state(null);

    // Sync Background Video Playback State
    $effect(() => {
        if (bgVideoNode && display.liveBackground) {
            bgVideoNode.playbackRate =
                display.liveBackground.playbackRate ?? 1.0;
            if (display.liveBackground.isPlaying && bgVideoNode.paused) {
                bgVideoNode.play().catch(() => {});
            } else if (
                !display.liveBackground.isPlaying &&
                !bgVideoNode.paused
            ) {
                bgVideoNode.pause();
            }
        }
    });

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

    function getSpeakerTimerColor(
        remainingMs: number,
        totalMs: number | null | undefined,
    ) {
        if (remainingMs < 0) return "text-red-500 animate-pulse";
        if (!totalMs || totalMs <= 0) return "text-emerald-400";

        const percentLeft = remainingMs / totalMs;

        if (percentLeft <= 0.2) return "text-red-500";
        if (percentLeft <= 0.5) return "text-amber-400";
        return "text-emerald-400";
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
            speakerTimerColorClass = getSpeakerTimerColor(
                diff,
                display.speakerTotalDurationMs,
            );
        } else if (
            display.speakerPausedRemainingMs !== null &&
            display.speakerPausedRemainingMs !== undefined
        ) {
            isSpeakerOverrun = display.speakerPausedRemainingMs < 0;
            speakerTimerText = formatTime(display.speakerPausedRemainingMs);
            speakerTimerColorClass = getSpeakerTimerColor(
                display.speakerPausedRemainingMs,
                display.speakerTotalDurationMs,
            );
        } else {
            speakerTimerText = null;
            isSpeakerOverrun = false;
            speakerTimerColorClass = "text-emerald-400";
        }
    }

    onMount(() => {
        tick();
        clockInterval = setInterval(tick, 200);
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
    <!-- 0. Ambient Background Layer -->
    {#if display.liveBackground}
        <div class="absolute inset-0 z-0">
            {#if display.liveBackground.type === "video"}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    bind:this={bgVideoNode}
                    src={display.liveBackground.url}
                    class="w-full h-full object-cover opacity-50 blur-[40px] scale-110"
                    loop
                    muted
                ></video>
            {:else}
                <img
                    src={display.liveBackground.url}
                    alt="Background"
                    class="w-full h-full object-cover opacity-50 blur-[40px] scale-110"
                />
            {/if}
        </div>
    {/if}

    <!-- Header / Info Bar (Frosted Glass) -->
    <header
        class="cq-header border-b border-white/10 flex items-center justify-between cq-px bg-zinc-950/70 backdrop-blur-md flex-shrink-0 z-20 font-sans"
    >
        <div class="flex items-center justify-between cq-gap">
            <span
                class="cq-badge bg-red-600/20 text-red-500 font-bold tracking-widest uppercase rounded-sm border border-red-600/30"
            >
                Live
            </span>
            {#if display.liveReference}
                <span
                    class="stage-reference cq-label-next-right text-gray-300 font-black drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-widest z-10"
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
                    >
                        {serviceTimerText}
                    </span>
                </div>
            {/if}

            {#if display.showSpeakerTimerOnStage && speakerTimerText && (display.liveText || display.liveMedia)}
                <div
                    class="flex flex-col items-end drop-shadow-xl bg-black/50 px-[2cqw] py-[1cqh] rounded-xl backdrop-blur-md border border-white/10"
                >
                    <span
                        class="text-[8cqh] font-black tabular-nums leading-none transition-colors duration-500 {speakerTimerColorClass}"
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
            >
                {display.stageMessage}
            </span>
        </div>
    {/if}

    <!-- Display Area -->
    <div class="flex-1 flex flex-col min-h-0 relative z-10">
        <!-- CURRENT SLIDE (Frosted Glass) -->
        <div
            class="transition-all duration-300 border-b border-white/10 cq-p flex flex-col relative bg-black/30 {display.stageShowNext ===
            false
                ? 'flex-1'
                : 'flex-[5]'}"
        >
            <div
                class="live-text-container flex-1 w-full h-full flex {horizontalAlignmentClass} {verticalAlignmentClass} px-4 md:px-12 relative z-10"
            >
                {#if display.liveMedia}
                    {#if display.liveMedia.type === "video"}
                        <video
                            src={display.liveMedia.url}
                            autoplay
                            muted
                            class="absolute inset-0 w-full h-full object-contain opacity-60 drop-shadow-2xl"
                        ></video>
                    {:else}
                        <img
                            src={display.liveMedia.url}
                            alt="Media"
                            class="absolute inset-0 w-full h-full object-contain opacity-60 drop-shadow-2xl"
                        />
                    {/if}
                    <div
                        class="absolute inset-0 flex flex-col items-center justify-center z-20 font-sans"
                    >
                        <span
                            class="bg-black/80 text-neon-cyan px-6 py-3 rounded-xl border border-neon-cyan/30 font-black uppercase tracking-[0.2em] cq-text-media-badge shadow-2xl backdrop-blur-md"
                        >
                            Now Showing Media
                        </span>
                    </div>
                {:else if display.liveText}
                    <div
                        class="stage-slide-text text-gray-100 transition-all whitespace-pre-wrap duration-300 w-full relative z-10 {getLiveTextScaleClass(
                            display.liveText,
                        )}"
                    >
                        {#if display.liveText !== LOADING_SLIDE_TEXT}
                            {@html display.liveText}
                        {/if}
                    </div>
                {:else}
                    {#if display.showSpeakerTimerOnStage && speakerTimerText}
                        <div
                            class="absolute inset-0 flex flex-col items-center justify-center z-10 animate-in zoom-in-95 duration-300 font-sans"
                        >
                            <span
                                class="text-zinc-400 text-[8cqh] font-bold uppercase tracking-widest mb-[2cqh]"
                                >Time Left</span
                            >
                            <span
                                class="text-[60cqh] font-black tabular-nums leading-none drop-shadow-2xl transition-colors duration-500 {speakerTimerColorClass}"
                            >
                                {speakerTimerText}
                            </span>
                        </div>
                    {/if}
                {/if}
            </div>
        </div>

        <!-- NEXT SLIDE (Frosted Glass) -->
        {#if display.stageShowNext !== false && display.nextText}
            <div
                class="flex-[2] cq-p flex flex-col relative bg-zinc-950/70 backdrop-blur-xl animate-in slide-in-from-bottom-4 z-20"
            >
                <div
                    class="next-text-container flex-1 w-full flex {horizontalAlignmentClass} justify-center px-8"
                >
                    {#if display.nextText}
                        <div
                            class="stage-next-text cq-text-next text-zinc-400 line-clamp-3 w-full whitespace-pre-wrap"
                        >
                            {#if display.nextText !== LOADING_SLIDE_TEXT}
                                {@html display.nextText}
                            {/if}
                        </div>
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

    :global(.stage-slide-text *),
    :global(.stage-next-text *) {
        font-family: inherit;
        font-size: inherit;
        text-transform: inherit;
        font-weight: inherit;
        letter-spacing: inherit;
        line-height: inherit;
        text-align: inherit;
        -webkit-text-stroke: inherit;
        paint-order: inherit;
        filter: inherit;
        margin: 0;
        white-space: pre-wrap;
    }

    :global(.stage-slide-text em) {
        font-style: italic !important;
    }
    :global(.stage-slide-text h1) {
        font-size: 1.8em;
        line-height: 1.1;
    }
    :global(.stage-slide-text h2) {
        font-size: 1.4em;
        line-height: 1.2;
    }
    :global(.stage-slide-text h3) {
        font-size: 1.2em;
        line-height: 1.2;
    }

    .stage-reference {
        font-family: var(--ref-font-family);
        font-weight: var(--ref-font-weight);
        text-transform: var(--ref-text-transform);
    }

    .cq-header {
        height: 10cqh;
    }
    .cq-px {
        padding-left: 4cqw;
        padding-right: 4cqw;
    }
    .cq-p {
        padding: 4cqw;
    }
    .cq-pt {
        padding-top: var(--v-gap, 0cqh);
    }
    .cq-pb {
        padding-bottom: var(--v-gap, 0cqh);
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
        font-size: 3.5cqw;
        top: 2cqh;
        right: 3cqw;
    }
    .live-text-container,
    .next-text-container {
        container-type: size;
    }

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
