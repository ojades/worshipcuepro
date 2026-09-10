<!-- src/lib/components/layout/display/ProjectorDisplay.svelte -->
<script lang="ts">
    import { settingsState } from "$lib/state/settings.svelte";
    import type { PresentationPayload } from "$lib/types/models";
    import { onMount } from "svelte";
    import { listen } from "@tauri-apps/api/event";

    export interface ExtendedPayload extends PresentationPayload {
        liveReference?: string | null;

        stageMessage?: string;
        showMessageOnProjector?: boolean;

        localServiceTargetTimestamp?: number | null;
        showServiceTimerOnProjector?: boolean;

        localSpeakerTargetTimestamp?: number | null;
        speakerPausedRemainingMs?: number | null;
        showSpeakerTimerOnProjector?: boolean;
        speakerTotalDurationMs?: number | null;
    }

    let { display }: { display: ExtendedPayload } = $props<{
        display: ExtendedPayload;
    }>();

    // Convert formatting config to standard CSS variables
    let styleString = $derived(`
            --font-family: "${display.projector?.textFormat?.fontFamily ?? "sans-serif"}", sans-serif;
            --text-transform: ${display.projector?.textFormat?.textTransform ?? "uppercase"};
            --font-weight: ${display.projector?.textFormat?.fontWeight ?? "bold"};
            --letter-spacing: ${display.projector?.textFormat?.letterSpacing ?? 0}px;
            --line-height: ${display.projector?.textFormat?.lineHeight ?? 1.2};
            --text-align: ${display.projector?.textFormat?.textAlign ?? "center"};
            --stroke-width: ${display.projector?.textFormat?.textStrokeWidth ?? 2}px;
            --stroke-color: ${display.projector?.textFormat?.textStrokeColor ?? "#000000"};
            --font-scale: ${(display.projector?.textScale ?? 1) * (display.projector?.textFormat?.fontSizeScale ?? 1)};
            --drop-shadow: ${display.projector?.textFormat?.dropShadow ? "drop-shadow(0 4px 6px rgba(0,0,0,0.8))" : "none"};
            --v-gap: ${display.projector?.vGap ?? 5}cqh;

            --ref-font-family: "${display.projector?.textFormat?.referenceFontFamily ?? display.projector?.textFormat?.fontFamily ?? "sans-serif"}", sans-serif;
            --ref-font-weight: ${display.projector?.textFormat?.referenceFontWeight ?? "bold"};
            --ref-text-transform: ${display.projector?.textFormat?.referenceTextTransform ?? "uppercase"};
            --ref-font-scale: ${(display.projector?.textScale ?? 1) * (display.projector?.textFormat?.referenceFontSizeScale ?? 1)};
        `);

    // Dynamic classes
    let alignmentClass = $derived.by(() => {
        switch (display.projector?.textVAlign) {
            case "top":
                return "justify-start cq-pt";
            case "bottom":
                return "justify-end cq-pb";
            case "middle":
            default:
                return "justify-center";
        }
    });

    let horizontalAlignmentClass = $derived.by(() => {
        switch (display.projector?.textFormat?.textAlign) {
            case "left":
                return "items-start";
            case "right":
                return "items-end";
            case "center":
            default:
                return "items-center";
        }
    });

    let referencePositionClass = $derived.by(() => {
        switch (display.projector?.referencePosition) {
            case "bottom-left":
                return "cq-pos-bottom cq-pos-left text-left";
            case "bottom-center":
                return "cq-pos-bottom left-0 right-0 text-center";
            case "top-right":
                return "cq-pos-top cq-pos-right text-right";
            case "top-left":
                return "cq-pos-top cq-pos-left text-left";
            case "top-center":
                return "cq-pos-top left-0 right-0 text-center";
            case "bottom-right":
            default:
                return "cq-pos-bottom cq-pos-right text-right";
        }
    });

    let serviceTimerText = $state("");
    let speakerTimerText = $state("");
    let isSpeakerOverrun = $state(false);
    let timerInterval: ReturnType<typeof setInterval>;
    let bgVideoNode: HTMLVideoElement | null = $state(null);

    // FIXED: Strictly pair toggles with active timestamps to prevent empty overlays
    let isServiceTimerVisible = $derived(
        display.showServiceTimerOnProjector &&
            !!display.localServiceTargetTimestamp,
    );

    let isSpeakerTimerVisible = $derived(
        display.showSpeakerTimerOnProjector &&
            (display.localSpeakerTargetTimestamp !== null ||
                display.speakerPausedRemainingMs !== null),
    );

    // --- Media Controller Effect ---
    $effect(() => {
        if (bgVideoNode && display.liveBackground) {
            bgVideoNode.muted = display.liveBackground.isMuted ?? true;
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

    function seamlessLoop(node: HTMLVideoElement) {
        const onTimeUpdate = () => {
            if (node.duration && node.currentTime >= node.duration - 0.15) {
                node.currentTime = 0.01;
            }
        };
        node.addEventListener("timeupdate", onTimeUpdate);
        return {
            destroy() {
                node.removeEventListener("timeupdate", onTimeUpdate);
            },
        };
    }

    function formatTime(ms: number) {
        const totalSeconds = Math.floor(Math.abs(ms) / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        let formatted = h > 0 ? `${h.toString().padStart(2, "0")}:` : "";
        formatted += `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        return ms < 0 ? `-${formatted}` : formatted;
    }

    onMount(() => {
        timerInterval = setInterval(() => {
            const now = Date.now();

            if (display.localServiceTargetTimestamp) {
                const diff = display.localServiceTargetTimestamp - now;
                serviceTimerText = diff <= 0 ? "00:00" : formatTime(diff);
            }
            if (
                display.localSpeakerTargetTimestamp !== null &&
                display.localSpeakerTargetTimestamp !== undefined
            ) {
                const diff = display.localSpeakerTargetTimestamp - now;
                isSpeakerOverrun = diff < 0;
                speakerTimerText = formatTime(diff);
            } else if (
                display.speakerPausedRemainingMs !== null &&
                display.speakerPausedRemainingMs !== undefined
            ) {
                isSpeakerOverrun = display.speakerPausedRemainingMs < 0;
                speakerTimerText = formatTime(display.speakerPausedRemainingMs);
            } else {
                speakerTimerText = "";
            }
        }, 200);

        const unlistenSeek = listen("media-seek", (e) => {
            if (bgVideoNode) bgVideoNode.currentTime = e.payload as number;
        });

        return () => {
            clearInterval(timerInterval);
            unlistenSeek.then((f) => f());
        };
    });
</script>

<div
    class="display-container absolute inset-0 overflow-hidden bg-black transition-opacity duration-500"
    class:opacity-0={display.isBlackout}
    style={styleString}
>
    <!-- 1. Background Layer (UNIFIED MEDIA) -->
    {#if display.liveBackground}
        {#if display.liveBackground.type === "video"}
            {#key display.liveBackground.url}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    bind:this={bgVideoNode}
                    src={display.liveBackground.url}
                    use:seamlessLoop
                    class="absolute inset-0 w-full h-full object-cover z-0"
                    loop
                ></video>
            {/key}
        {:else}
            <img
                src={display.liveBackground.url}
                alt="Background"
                class="absolute inset-0 w-full h-full object-cover z-0"
            />
        {/if}
    {/if}

    <!-- 2. Main Text Layer -->
    <div
        class="absolute inset-0 z-10 flex flex-col cq-px transition-opacity duration-300 {alignmentClass} {horizontalAlignmentClass}"
        class:opacity-0={display.isTextCleared}
    >
        <div
            class="relative flex-col w-full flex justify-center {horizontalAlignmentClass}"
        >
            {#if display.liveText}
                <div
                    class="slide-text text-white cq-pb-offset w-full text-center whitespace-pre-wrap"
                >
                    {@html display.liveText}
                </div>
            {/if}

            {#if display.liveReference}
                <div
                    class="absolute z-20 transition-opacity duration-300 -mb-2 {referencePositionClass}"
                >
                    <p class="slide-reference text-white/90">
                        {display.liveReference}
                    </p>
                </div>
            {/if}
        </div>
    </div>

    <!-- 3. Alert Message Layer -->
    {#if display.showMessageOnProjector && display.stageMessage}
        <div
            class="absolute top-[8cqh] inset-x-0 z-50 flex items-center justify-center animate-in slide-in-from-top duration-500"
        >
            <div
                class="bg-red-600 border border-red-400 text-white py-[2cqh] px-[6cqw] rounded-full shadow-[0_20px_50px_rgba(220,38,38,0.5)]"
            >
                <span
                    class="text-[4cqh] font-black uppercase tracking-widest animate-pulse"
                    >{display.stageMessage}</span
                >
            </div>
        </div>
    {/if}

    <!-- 4. Timers Layer (FIXED: Using strictly tied derived states) -->
    {#if (isServiceTimerVisible || isSpeakerTimerVisible) && !display.liveText}
        <div
            class="absolute inset-0 z-40 flex flex-col gap-[4cqh] items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-500"
        >
            {#if isServiceTimerVisible}
                <div class="text-center drop-shadow-2xl">
                    <div
                        class="text-zinc-400 text-[3cqh] font-bold uppercase tracking-widest mb-[-2cqh]"
                    >
                        Next Session Starts In
                    </div>
                    <div
                        class="text-[20cqw] font-black tabular-nums text-white leading-none tracking-tighter"
                    >
                        {serviceTimerText}
                    </div>
                </div>
            {/if}

            {#if isSpeakerTimerVisible}
                <div class="text-center drop-shadow-2xl">
                    <div
                        class="text-zinc-400 text-[2cqh] font-bold uppercase tracking-widest mb-[1cqh]"
                    >
                        Speaker Duration
                    </div>
                    <div
                        class="text-[8cqw] font-black tabular-nums leading-none tracking-tighter {isSpeakerOverrun
                            ? 'text-red-500 animate-pulse'
                            : 'text-emerald-400'}"
                    >
                        {speakerTimerText}
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .display-container {
        container-type: size;
    }
    .slide-text {
        font-family: var(--font-family);
        text-transform: var(--text-transform);
        font-weight: var(--font-weight);
        letter-spacing: var(--letter-spacing);
        line-height: var(--line-height);
        text-align: var(--text-align);
        font-size: calc(3cqw * var(--font-scale));
        -webkit-text-stroke: var(--stroke-width) var(--stroke-color);
        paint-order: stroke fill;
        filter: var(--drop-shadow);
    }
    .slide-reference {
        font-family: var(--ref-font-family);
        font-weight: var(--ref-font-weight);
        text-transform: var(--ref-text-transform);
        font-size: calc(3cqw * var(--ref-font-scale));
        -webkit-text-stroke: calc(var(--stroke-width) * 0.5) var(--stroke-color);
        paint-order: stroke fill;
        filter: var(--drop-shadow);
    }
    .cq-px {
        padding-left: 5cqw;
        padding-right: 5cqw;
    }
    .cq-pt {
        padding-top: var(--v-gap, 5cqh);
    }
    .cq-pb {
        padding-bottom: var(--v-gap, 5cqh);
    }
    .cq-pb-offset {
        padding-bottom: 10cqh;
    }
    .cq-pos-bottom {
        bottom: 1cqh;
    }
    .cq-pos-top {
        top: 5cqh;
    }
    .cq-pos-left {
        left: 5cqw;
    }
    .cq-pos-right {
        right: 5cqw;
    }
    :global(.slide-text *) {
        font-family: inherit;
        text-transform: inherit;
        font-weight: inherit;
        letter-spacing: inherit;
        text-align: inherit;
        -webkit-text-stroke: inherit;
        paint-order: inherit;
        filter: inherit;
        margin: 0;
        white-space: pre-wrap;
    }
    :global(.slide-text em) {
        font-style: italic !important;
    }
    :global(.slide-text h1) {
        font-size: 1.8em;
        line-height: 1.1;
    }
    :global(.slide-text h2) {
        font-size: 1.4em;
        line-height: 1.2;
    }
    :global(.slide-text h3) {
        font-size: 1.2em;
        line-height: 1.2;
    }
</style>
