<!-- src/lib/components/layout/ControlPanel.svelte -->
<script lang="ts">
    import { Form, Monitor, Projector, User } from "@lucide/svelte";
    import { systemState } from "$lib/state/system.svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { controlsState } from "$lib/state/controls.svelte"; // NEW

    import ProjectorDisplay from "$lib/components/layout/display/ProjectorDisplay.svelte";
    import StageDisplay from "$lib/components/layout/display/StageDisplay.svelte";
    import ControlPanelTabs from "./controlpanel/ControlPanelTabs.svelte";
    import FormatControls from "./controlpanel/FormatControls.svelte";
    import { settingsState } from "$lib/state/settings.svelte";

    let previewTab = $state<"confidence" | "audience">("confidence");
    let live = $derived(systemState.isProjectorOpen || systemState.isStageOpen);

    // Map internal presentation & control state perfectly to the display components
    let displayPayload = $derived({
        // Presentation Data
        liveText: presentation.liveText,
        nextText: presentation.liveNextText,
        liveBackground: presentation.liveBackground,
        liveMedia: presentation.liveMedia,
        isBlackout: presentation.isBlackout,
        isTextCleared: presentation.isTextCleared,
        liveReference: presentation.liveReference,

        // Settings
        linesPerSlide: presentation.linesPerSlide,
        stage: {
            textScale: settingsState.config.stage?.textScale,
            textVAlign: settingsState.config.stage?.textVAlign,
            referencePosition: settingsState.config.stage?.referencePosition,
        },
        projector: {
            textScale: settingsState.config.projector?.textScale,
            textVAlign: settingsState.config.projector?.textVAlign,
            referencePosition:
                settingsState.config.projector?.referencePosition,
        },
        // textScale: (settingsState.config as any).textScale ?? 1.0,
        // stageTextScale: (settingsState.config as any).stageTextScale ?? 1.0,
        // alignment: (settingsState.config as any).projectorAlignment || "middle",
        // referencePosition:
        //     (settingsState.config as any).bibleReferencePosition ||
        //     "bottom-right",

        // Stage Controls Routing Mapping
        stageMessage: controlsState.stageMessage,
        showMessageOnStage: controlsState.showMessageOnStage,
        showMessageOnProjector: controlsState.showMessageOnProjector,

        serviceTargetTimestamp: controlsState.serviceTargetTimestamp,
        showServiceTimerOnStage: controlsState.showServiceTimerOnStage,
        showServiceTimerOnProjector: controlsState.showServiceTimerOnProjector,

        speakerTargetTimestamp: controlsState.speakerTargetTimestamp,
        speakerPausedRemainingMs: controlsState.speakerPausedRemainingMs,
        showSpeakerTimerOnStage: controlsState.showSpeakerTimerOnStage,
        showSpeakerTimerOnProjector: controlsState.showSpeakerTimerOnProjector,
    });
</script>

<div
    class="bg-zinc-900 border border-border rounded-xl p-4 flex flex-col gap-4 h-full max-h-full font-sans w-full overflow-hidden"
>
    <!-- Header Section -->
    <div
        class="border-b border-border pb-2 shrink-0 flex items-center justify-between"
    >
        <h2
            class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
        >
            Control Panel
        </h2>
        <div class="flex items-center gap-1.5">
            <div
                class="w-2 h-2 rounded-full transition-all duration-300 {live
                    ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                    : 'bg-muted'}"
            ></div>
            <span class="text-[10px] font-medium text-muted-foreground"
                >{live ? "LIVE" : "STANDBY"}</span
            >
        </div>
    </div>

    <!-- Live Output Preview Grid Frame -->
    <div class="space-y-2 shrink-0">
        <!-- Preview Header & Tabs -->
        <div class="flex items-center justify-between">
            <h3
                class="text-sm font-semibold text-foreground flex items-center gap-2"
            >
                {#if previewTab === "confidence"}
                    <User size={16} class="text-neon-cyan" /> Confidence
                {:else}
                    <Projector size={16} class="text-neon-violet" /> Audience
                {/if}
            </h3>

            <div
                class="flex items-center bg-zinc-950 rounded-md p-0.5 border border-border"
            >
                <button
                    onclick={() => (previewTab = "confidence")}
                    class="px-2 py-1 text-[10px] font-bold uppercase rounded-sm transition-colors {previewTab ===
                    'confidence'
                        ? 'bg-zinc-800 text-neon-cyan shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'}"
                >
                    Stage
                </button>
                <button
                    onclick={() => (previewTab = "audience")}
                    class="px-2 py-1 text-[10px] font-bold uppercase rounded-sm transition-colors {previewTab ===
                    'audience'
                        ? 'bg-zinc-800 text-neon-violet shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'}"
                >
                    Projector
                </button>
            </div>
        </div>

        <!-- SHARED PREVIEW DISPLAY MOUNT -->
        <div
            class="aspect-video bg-black rounded-lg overflow-hidden ring-1 ring-border relative flex flex-col group transition-all duration-300 shadow-inner {previewTab ===
            'confidence'
                ? 'hover:border-neon-cyan/40'
                : 'hover:border-neon-violet/40'}"
        >
            {#if previewTab === "audience"}
                <ProjectorDisplay display={displayPayload} />

                {#if !presentation.liveText && !presentation.liveBackground && !presentation.liveMedia && !presentation.isBlackout}
                    <div
                        class="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
                    >
                        <span
                            class="text-xs text-zinc-500 font-mono bg-black/80 px-3 py-1.5 rounded-md shadow-lg border border-zinc-800"
                        >
                            {systemState.isLive
                                ? "🔴 OUTPUT ACTIVE"
                                : "⏸️ SYSTEM IDLE"}
                        </span>
                    </div>
                {/if}
            {:else}
                <StageDisplay display={displayPayload} />
            {/if}
        </div>
    </div>

    <ControlPanelTabs />
    <FormatControls />
</div>
