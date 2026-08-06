<!-- src/lib/components/layout/controlpanel/formatControlMenus/TextFormatmenu.svelte -->
<script lang="ts">
    import { settingsState } from "$lib/state/settings.svelte";
    import { Monitor, User, Settings2 } from "@lucide/svelte";
    import { slide } from "svelte/transition";
    import DisplayFormatForm from "./DisplayFormatForm.svelte";

    let activeTab = $state<"projector" | "stage">("projector");
</script>

<div
    transition:slide={{ duration: 250, axis: "y" }}
    class="absolute bottom-full left-0 w-full mb-2 bg-zinc-950 border border-border rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col z-50"
>
    <!-- Tabs -->
    <div class="flex border-b border-border bg-zinc-900/50">
        <button
            class="flex-1 py-2.5 text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 transition-colors {activeTab ===
            'stage'
                ? 'text-neon-cyan border-b-2 border-neon-cyan bg-zinc-800/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-zinc-900/30'}"
            onclick={() => (activeTab = "stage")}
        >
            <User size={14} /> Stage
        </button>
        <button
            class="flex-1 py-2.5 text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 transition-colors {activeTab ===
            'projector'
                ? 'text-neon-violet border-b-2 border-neon-violet bg-zinc-800/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-zinc-900/30'}"
            onclick={() => (activeTab = "projector")}
        >
            <Monitor size={14} /> Projector
        </button>
    </div>

    <!-- Active Form Controls (Capped height to prevent covering preview) -->
    <div class="max-h-[280px] overflow-y-auto scrollbar-none">
        <DisplayFormatForm target={activeTab} />
    </div>

    <!-- Global Setting: Lines/Slide -->
    <div
        class="px-4 py-3 bg-zinc-900/40 border-t border-border flex items-center justify-between"
    >
        <div class="flex items-center gap-2 text-muted-foreground">
            <Settings2 size={14} />
            <span class="text-[10px] font-bold uppercase tracking-wider"
                >Lines per Slide</span
            >
        </div>
        <select
            class="bg-zinc-950 border border-border text-xs text-foreground rounded-md px-2 py-1 outline-none focus:border-neon-violet transition-colors cursor-pointer"
            value={settingsState.config.linesPerSlide || 0}
            onchange={(e) => {
                const oldValue = settingsState.config;
                settingsState.update({
                    ...oldValue,
                    linesPerSlide: Number(e.currentTarget.value),
                });
            }}
        >
            <option value={0}>Default Auto</option>
            <option value={1}>1 Line</option>
            <option value={2}>2 Lines</option>
            <option value={4}>4 Lines</option>
            <option value={6}>6 Lines</option>
            <option value={8}>8 Lines</option>
        </select>
    </div>
</div>
