<script lang="ts">
    import "../../app.css";
    import { page } from "$app/stores";

    // Global Layout Components
    import SideNav from "$lib/components/layout/SideNav.svelte";
    import ControlPanel from "$lib/components/layout/ControlPanel.svelte";

    // State
    import HeaderBar from "$lib/components/layout/HeaderBar.svelte";

    let { children } = $props();

    // Derive current workspace from the URL for the Header and Panel toggling
    let currentWorkspace = $derived(() => {
        const path = $page.url.pathname;
        if (path.includes("/lyrics")) return "lyrics";
        if (path.includes("/bibles")) return "bibles";
        if (path.includes("/media")) return "media";
        if (path.includes("/shoots")) return "shoots";
        if (path.includes("/settings")) return "settings";
        return "cue"; // Default root route
    });
</script>

<div
    class="flex h-screen w-screen bg-background text-foreground antialiased overflow-hidden select-none"
>
    <!-- Left Sidebar Navigation Wrapper -->
    <SideNav />

    <!-- Right Side Content Stack -->
    <div class="flex-1 flex flex-col min-w-0 h-full relative">
        <!-- Global Action Bar -->
        <HeaderBar title={currentWorkspace()} />
        <!-- Core Content Partition Workspace -->
        <div class="flex-1 flex min-h-0 w-full overflow-hidden">
            <!-- SvelteKit Router Switching Container -->
            <div
                class="flex-1 overflow-hidden min-w-0 bg-background flex flex-col"
            >
                {@render children()}
            </div>

            <!-- Right-Hand Dedicated Control Column & Stacked Live Monitor Previews -->
            {#if currentWorkspace() !== "settings"}
                <aside
                    class="w-[28vw] border-l border-border bg-card/20 flex flex-col min-h-0 h-full"
                >
                    <div class="flex-1 overflow-y-auto p-4 min-h-0">
                        <ControlPanel />
                    </div>
                </aside>
            {/if}
        </div>
    </div>
</div>
