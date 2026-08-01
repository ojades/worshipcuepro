<!-- src/lib/components/layout/controlpanel/ControlPanelTabs.svelte -->
<script lang="ts">
    import { ListMusic, LibraryIcon, MonitorSpeaker } from "@lucide/svelte";
    import UpNextTab from "./tabs/UpNextTab.svelte";
    import LibraryTab from "./tabs/LibraryTab.svelte";
    import ControlsTab from "./tabs/ControlsTab.svelte";

    // "active" = Up Next, "library" = Library, "stage" = Stage Controls
    let activeTab = $state<"active" | "library" | "stage">("active");
</script>

<div class="flex-1 min-h-0 flex flex-col pt-2 border-t border-border">
    <!-- Segmented Tab Control -->
    <div
        class="flex items-center bg-background/50 p-1 rounded-lg border border-border mb-3 shrink-0"
    >
        <button
            class="flex-1 flex items-center justify-center gap-2 text-xs py-1.5 px-2 rounded-md transition-all font-medium {activeTab ===
            'active'
                ? 'bg-zinc-800 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800/50'}"
            onclick={() => (activeTab = "active")}
        >
            <ListMusic
                size={14}
                class={activeTab === "active" ? "text-neon-violet" : ""}
            />
            Up Next
        </button>
        <button
            class="flex-1 flex items-center justify-center gap-2 text-xs py-1.5 px-2 rounded-md transition-all font-medium {activeTab ===
            'library'
                ? 'bg-zinc-800 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800/50'}"
            onclick={() => (activeTab = "library")}
        >
            <LibraryIcon
                size={14}
                class={activeTab === "library" ? "text-neon-cyan" : ""}
            />
            Library
        </button>
        <button
            class="flex-1 flex items-center justify-center gap-2 text-xs py-1.5 px-2 rounded-md transition-all font-medium {activeTab ===
            'stage'
                ? 'bg-zinc-800 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800/50'}"
            onclick={() => (activeTab = "stage")}
        >
            <MonitorSpeaker
                size={14}
                class={activeTab === "stage" ? "text-emerald-400" : ""}
            />
            Stage
        </button>
    </div>

    <!-- Scrollable Area / Dynamic Tab Content -->
    <div
        class="flex-1 overflow-y-auto flex flex-col custom-scrollbar pr-1 relative"
    >
        {#if activeTab === "active"}
            <UpNextTab onBrowseLibrary={() => (activeTab = "library")} />
        {:else if activeTab === "library"}
            <LibraryTab onPlaylistLoaded={() => (activeTab = "active")} />
        {:else if activeTab === "stage"}
            <ControlsTab />
        {/if}
    </div>
</div>

<style>
    /* CRITICAL HACK: This stops inner SVG and span elements from triggering dragleave/dragenter loops
       which cause the browser to abort the drop action */
    :global(body.dragging-active .playlist-item *) {
        pointer-events: none !important;
    }
</style>
