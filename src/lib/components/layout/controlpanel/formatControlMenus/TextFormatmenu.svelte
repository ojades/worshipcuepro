<script lang="ts">
    import { presentation } from "$lib/state/presentation.svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import {
        AlignVerticalJustifyCenter,
        AlignVerticalJustifyEnd,
        AlignVerticalJustifyStart,
        Monitor,
        Settings2,
        User,
    } from "@lucide/svelte";
    import { slide } from "svelte/transition";

    let activeTab = $state<"projector" | "stage">("projector");

    // Helper to extract safely or default

    let projectorScale = $derived(
        settingsState.config.projector?.textScale ?? 1.0,
    );
    let stageScale = $derived(settingsState.config.stage?.textScale ?? 1.0);
    let projectorAlignment = $derived(
        (settingsState.config as any).projectorAlignment ?? "middle",
    );

    function updateSetting(key: string, value: any) {
        const oldValue = settingsState.config[activeTab];
        settingsState.update({ [activeTab]: { ...oldValue, [key]: value } });
    }
</script>

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
        <!-- Text Scale -->
        <div class="space-y-2">
            <div class="flex justify-between items-center">
                <label
                    for="projector-scale"
                    class="text-xs text-muted-foreground font-medium"
                    >Font Scale</label
                >
                <span
                    class="text-xs font-mono {activeTab === 'projector'
                        ? 'text-neon-violet'
                        : 'text-neon-cyan'}"
                    >{Math.round(
                        (activeTab === "projector"
                            ? projectorScale
                            : stageScale) * 100,
                    )}%</span
                >
            </div>
            <input
                id="projector-scale"
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={activeTab === "projector" ? projectorScale : stageScale}
                oninput={(e) =>
                    updateSetting(
                        "textScale",
                        parseFloat(e.currentTarget.value),
                    )}
                class="w-full {activeTab === 'projector'
                    ? 'accent-neon-violet'
                    : 'accent-neon-cyan'}"
            />
        </div>
        <!-- Vertical Alignment -->
        <div class="space-y-2">
            <label
                for="projector-alignment-top"
                class="text-xs text-muted-foreground font-medium"
                >Vertical Alignment</label
            >
            <div class="flex bg-zinc-900 rounded-md border border-border p-0.5">
                <button
                    id="projector-alignment-top"
                    class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {projectorAlignment ===
                    'top'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'}"
                    onclick={() => updateSetting("projectorAlignment", "top")}
                    title="Top Align"
                    ><AlignVerticalJustifyStart size={16} /></button
                >
                <button
                    class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {projectorAlignment ===
                    'middle'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'}"
                    onclick={() =>
                        updateSetting("projectorAlignment", "middle")}
                    title="Middle Align"
                    ><AlignVerticalJustifyCenter size={16} /></button
                >
                <button
                    class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {projectorAlignment ===
                    'bottom'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'}"
                    onclick={() =>
                        updateSetting("projectorAlignment", "bottom")}
                    title="Bottom Align"
                    ><AlignVerticalJustifyEnd size={16} /></button
                >
            </div>
        </div>
        <!-- Lines/Slide -->
        <div class="space-y-2">
            <label
                for="projector-scale"
                class="text-xs text-muted-foreground font-medium"
                >Lines/Slide</label
            >
            <div
                class="flex items-center gap-2 bg-card/50 border border-zinc-800 rounded-lg px-2 py-1 shadow-sm"
            >
                <Settings2 size={16} class="text-muted-foreground" />
                <span
                    class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1"
                >
                    Lines
                </span>
                <select
                    class="bg-background border border-border text-xs rounded-md px-2 py-1 outline-none focus:border-neon-violet transition-colors cursor-pointer"
                    value={settingsState.config.linesPerSlide}
                    onchange={(e) => {
                        const oldValue = settingsState.config;
                        settingsState.update({
                            ...oldValue,
                            linesPerSlide: Number(e.currentTarget.value),
                        });
                    }}
                    title="Format lines per slide"
                >
                    <option value={0}>Default</option>
                    <option value={2}>2</option>
                    <option value={4}>4 </option>
                    <option value={6}>6 </option>
                </select>
            </div>
        </div>
    </div>
</div>
