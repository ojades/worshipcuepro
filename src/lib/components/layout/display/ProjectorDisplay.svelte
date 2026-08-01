<script lang="ts">
    import { settingsState } from "$lib/state/settings.svelte";
    import type { PresentationPayload } from "$lib/types/models";
    import { onMount, onDestroy } from "svelte";
    export interface ExtendedPayload extends PresentationPayload {
        alignment?: "top" | "middle" | "bottom";
        liveReference?: string | null;
        referencePosition?:
            "bottom-right" | "bottom-left" | "top-right" | "top-left";
        textScale?: number;
        stageTextScale?: number;

        // Controls Routing Payload
        stageMessage?: string;
        showMessageOnProjector?: boolean;

        serviceTargetTimestamp?: number | null;
        showServiceTimerOnProjector?: boolean;

        speakerTargetTimestamp?: number | null;
        speakerPausedRemainingMs?: number | null;
        showSpeakerTimerOnProjector?: boolean;
    }

    let { display } = $props<{ display: ExtendedPayload }>();

    // Dynamic classes
    let alignmentClass = $derived.by(() => {
        switch (display.alignment) {
            case "top":
                return "justify-start cq-pt";
            case "bottom":
                return "justify-end cq-pb";
            case "middle":
            default:
                return "justify-center";
        }
    });

    let referencePositionClass = $derived.by(() => {
        switch (display.referencePosition) {
            case "bottom-left":
                return "cq-pos-bottom cq-pos-left text-left";
            case "top-right":
                return "cq-pos-top cq-pos-right text-right";
            case "top-left":
                return "cq-pos-top cq-pos-left text-left";
            case "bottom-right":
            default:
                return "cq-pos-bottom cq-pos-right text-right";
        }
    });

    let mediaPaddingClass = $derived(!display.liveMedia?.url ? "cq-px" : "");

    // --- Ticker Logic for Timers ---
    let serviceTimerText = $state("");
    let speakerTimerText = $state("");
    let isSpeakerOverrun = $state(false);
    let timerInterval: ReturnType<typeof setInterval>;

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

            // Service Timer
            if (display.serviceTargetTimestamp) {
                const diff = display.serviceTargetTimestamp - now;
                serviceTimerText = diff <= 0 ? "00:00" : formatTime(diff);
            }

            // Speaker Timer
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
            }
        }, 200);
    });

    onDestroy(() => {
        clearInterval(timerInterval);
    });
</script>

<div
    class="display-container absolute inset-0 overflow-hidden bg-black transition-opacity duration-500"
    class:opacity-0={display.isBlackout}
>
    <!-- 1. Background Layer -->
    {#if display.liveBackground}
        {#if display.liveBackground.type === "video"}
            {#key display.liveBackground.url}
                <video
                    src={display.liveBackground.url}
                    class="absolute inset-0 w-full h-full object-cover z-0"
                    autoplay
                    loop
                    muted
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

    <!-- 2. Main Text / Media Layer -->
    <div
        class="absolute inset-0 z-10 flex flex-col items-center {mediaPaddingClass} transition-opacity duration-300 {alignmentClass}"
        class:opacity-0={display.isTextCleared}
    >
        <div class="relative flex-col w-full flex items-center justify-center">
            <!-- Foreground Media Handling -->
            {#if display.liveMedia}
                {#if display.liveMedia.type === "video"}
                    {#key display.liveMedia?.url}
                        <!-- svelte-ignore a11y_media_has_caption -->
                        <video
                            src={display.liveMedia.url}
                            class="absolute inset-0 w-full h-screen object-cover z-10"
                            autoplay
                        ></video>
                    {/key}
                {:else}
                    <img
                        src={display.liveMedia.url}
                        alt="Media Presentation"
                        class="w-full max-h-[90cqh] object-contain drop-shadow-2xl z-10"
                    />
                {/if}

                <!-- Standard Text Handling -->
            {:else if display.liveText}
                <p
                    class="text-white cq-pb-offset font-bold text-center leading-tight whitespace-pre-wrap drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
                    style="font-size: {(display.textScale ?? 1) * 6}cqw;"
                >
                    {display.liveText}
                </p>
            {/if}

            <!-- Bible Reference Layer -->
            {#if display.liveReference}
                <div
                    class="absolute z-20 transition-opacity duration-300 {referencePositionClass}"
                >
                    <p
                        class="text-white/80 font-bold drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)]"
                        style="font-size: {(display.textScale ?? 1) * 3}cqw;"
                    >
                        {display.liveReference}
                    </p>
                </div>
            {/if}
        </div>
    </div>

    <!-- 3. Alert Message Layer (Routed to Projector) -->
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

    <!-- 4. Timers Layer (Routed to Projector) -->
    {#if (display.showServiceTimerOnProjector || display.showSpeakerTimerOnProjector) && (display.serviceTargetTimestamp || display.speakerTargetTimestamp)}
        <div
            class="absolute inset-0 z-40 flex flex-col gap-[4cqh] items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-500"
        >
            {#if display.showServiceTimerOnProjector && display.serviceTargetTimestamp}
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

            {#if display.showSpeakerTimerOnProjector && (display.speakerTargetTimestamp !== null || display.speakerPausedRemainingMs !== null)}
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

    .cq-px {
        padding-left: 5cqw;
        padding-right: 5cqw;
    }
    .cq-pt {
        padding-top: 2cqh;
    }
    .cq-pb {
        padding-bottom: 2cqh;
    }
    .cq-pb-offset {
        padding-bottom: 10cqh;
    }
    .cq-pos-bottom {
        bottom: 5cqh;
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
</style>
