<!-- /src/lib/components/layout/controlpanel/FormatControls.svelte -->
<script lang="ts">
    import {
        Type,
        AlignVerticalJustifyStart,
        AlignVerticalJustifyCenter,
        AlignVerticalJustifyEnd,
        Monitor,
        User,
        X,
    } from "@lucide/svelte";
    import { slide } from "svelte/transition";
    import { settingsState } from "$lib/state/settings.svelte";

    let isOpen = $state(false);
    let activeTab = $state<"projector" | "stage">("projector");

    // Helper to extract safely or default
    let projectorScale = $derived(
        (settingsState.config as any).textScale ?? 1.0,
    );
    let stageScale = $derived(
        (settingsState.config as any).stageTextScale ?? 1.0,
    );
    let projectorAlignment = $derived(
        (settingsState.config as any).projectorAlignment ?? "middle",
    );

    function updateSetting(key: string, value: any) {
        settingsState.update({ [key]: value });
    }
</script>

<div class="relative mt-auto shrink-0 z-50">
    <!-- Slide-up Menu -->
    {#if isOpen}
        <div
            transition:slide={{ duration: 250, axis: "y" }}
            class="absolute bottom-full left-0 w-full mb-2 bg-zinc-950 border border-border rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
        >
            <!-- Tabs -->
            <div class="flex border-b border-border bg-zinc-900/50">
                <button
                    class="flex-1 py-2 text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 transition-colors {activeTab ===
                    'projector'
                        ? 'text-neon-violet border-b-2 border-neon-violet bg-zinc-800/50'
                        : 'text-muted-foreground hover:text-foreground'}"
                    onclick={() => (activeTab = "projector")}
                >
                    <Monitor size={12} /> Projector
                </button>
                <button
                    class="flex-1 py-2 text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 transition-colors {activeTab ===
                    'stage'
                        ? 'text-neon-cyan border-b-2 border-neon-cyan bg-zinc-800/50'
                        : 'text-muted-foreground hover:text-foreground'}"
                    onclick={() => (activeTab = "stage")}
                >
                    <User size={12} /> Stage
                </button>
            </div>

            <!-- Controls Body -->
            <div class="p-4 space-y-4">
                {#if activeTab === "projector"}
                    <!-- Projector Scale -->
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <label
                                for="projector-scale"
                                class="text-xs text-muted-foreground font-medium"
                                >Font Scale</label
                            >
                            <span class="text-xs font-mono text-neon-violet"
                                >{Math.round(projectorScale * 100)}%</span
                            >
                        </div>
                        <input
                            id="projector-scale"
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={projectorScale}
                            oninput={(e) =>
                                updateSetting(
                                    "textScale",
                                    parseFloat(e.currentTarget.value),
                                )}
                            class="w-full accent-neon-violet"
                        />
                    </div>

                    <!-- Projector Alignment -->
                    <div class="space-y-2">
                        <label
                            for="projector-alignment-top"
                            class="text-xs text-muted-foreground font-medium"
                            >Vertical Alignment</label
                        >
                        <div
                            class="flex bg-zinc-900 rounded-md border border-border p-0.5"
                        >
                            <button
                                id="projector-alignment-top"
                                class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {projectorAlignment ===
                                'top'
                                    ? 'bg-zinc-800 text-white'
                                    : 'text-zinc-500 hover:text-zinc-300'}"
                                onclick={() =>
                                    updateSetting("projectorAlignment", "top")}
                                title="Top Align"
                                ><AlignVerticalJustifyStart size={16} /></button
                            >
                            <button
                                class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {projectorAlignment ===
                                'middle'
                                    ? 'bg-zinc-800 text-white'
                                    : 'text-zinc-500 hover:text-zinc-300'}"
                                onclick={() =>
                                    updateSetting(
                                        "projectorAlignment",
                                        "middle",
                                    )}
                                title="Middle Align"
                                ><AlignVerticalJustifyCenter
                                    size={16}
                                /></button
                            >
                            <button
                                class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {projectorAlignment ===
                                'bottom'
                                    ? 'bg-zinc-800 text-white'
                                    : 'text-zinc-500 hover:text-zinc-300'}"
                                onclick={() =>
                                    updateSetting(
                                        "projectorAlignment",
                                        "bottom",
                                    )}
                                title="Bottom Align"
                                ><AlignVerticalJustifyEnd size={16} /></button
                            >
                        </div>
                    </div>
                {:else}
                    <!-- Stage Scale -->
                    <div class="space-y-2">
                        <div class="flex justify-between items-center">
                            <label
                                for="stage-font-scale"
                                class="text-xs text-muted-foreground font-medium"
                                >Stage Font Scale</label
                            >
                            <span class="text-xs font-mono text-neon-cyan"
                                >{Math.round(stageScale * 100)}%</span
                            >
                        </div>
                        <input
                            id="stage-font-scale"
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={stageScale}
                            oninput={(e) =>
                                updateSetting(
                                    "stageTextScale",
                                    parseFloat(e.currentTarget.value),
                                )}
                            class="w-full accent-neon-cyan"
                        />
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Bottom Action Strip -->
    <div class="flex items-center gap-2 border-t border-border pt-3">
        <button
            onclick={() => (isOpen = !isOpen)}
            class="p-2 rounded-md transition-colors border {isOpen
                ? 'bg-zinc-800 border-zinc-700 text-white'
                : 'bg-zinc-950 border-border text-muted-foreground hover:text-foreground hover:bg-zinc-900'}"
            title="Formatting Options"
        >
            {#if isOpen}
                <X size={16} />
            {:else}
                <Type size={16} />
            {/if}
        </button>

        <!-- Add other global toolbar buttons here in the future -->
    </div>
</div>
