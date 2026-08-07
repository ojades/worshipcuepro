<!-- /src/routes/(app)/operator/settings/+page.svelte -->
<script lang="ts">
    // Import the decoupled components
    import WorkspaceSettings from "$lib/components/layout/settings/WorkspaceSettings.svelte";
    import BibleSettings from "$lib/components/layout/settings/BibleSettings.svelte";
    import RemoteDisplay from "$lib/components/layout/settings/RemoteDisplay.svelte";
    import {
        FolderSync,
        BookOpen,
        Monitor,
        SlidersHorizontal,
        Library,
        Network,
        Info,
        Cast,
    } from "@lucide/svelte";
    import Integrations from "$lib/components/layout/settings/Integrations.svelte";
    import FontSettings from "$lib/components/layout/settings/FontSettings.svelte";
    import ObsSettings from "$lib/components/layout/settings/ObsSettings.svelte";
    import { onMount } from "svelte";
    import { getVersion } from "@tauri-apps/api/app";

    type Category =
        | "workspace"
        | "bibles"
        | "display"
        | "fonts"
        | "media"
        | "obs"
        | "integrations"
        | "about";

    let activeCategory = $state<Category>("workspace");

    let appVersion = $state<string>("Loading...");

    onMount(async () => {
        try {
            appVersion = await getVersion();
        } catch (error) {
            console.error("Failed to get app version", error);
            appVersion = "Unknown";
        }
    });

    const menuItems: { id: Category; label: string; icon: any }[] = [
        { id: "workspace", label: "Workspace & Sync", icon: FolderSync },
        { id: "bibles", label: "Bible Translations", icon: BookOpen }, // New Item
        { id: "display", label: "Remote Display", icon: Cast },
        {
            id: "fonts",
            label: "Manage Fonts",
            icon: SlidersHorizontal,
        },
        { id: "media", label: "Media Library", icon: Library },
        { id: "obs", label: "OBS Settings", icon: Monitor },
        { id: "integrations", label: "Integrations", icon: Network },
        { id: "about", label: "About", icon: Info },
    ];
</script>

<svelte:head>
    <title>WorshipCuePro - Settings</title>
</svelte:head>

<div
    class="flex-1 flex h-full overflow-hidden bg-background font-sans text-foreground"
>
    <!-- Left Pane - Settings Menu -->
    <div class="w-1/4 border-r border-border bg-card/30 flex flex-col">
        <div class="p-6 pb-2">
            <h2
                class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
            >
                Settings
            </h2>
        </div>

        <nav class="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
            {#each menuItems as item}
                <button
                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                    {activeCategory === item.id
                        ? 'bg-neon-violet/10 text-neon-violet shadow-[0_0_10px_rgba(147,51,234,0.05)]'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
                    onclick={() => (activeCategory = item.id)}
                >
                    <item.icon
                        size={18}
                        strokeWidth={activeCategory === item.id ? 2 : 1.5}
                    />
                    {item.label}
                </button>
            {/each}
        </nav>
    </div>

    <!-- Right Pane - Configuration Area -->
    <div class="flex-1 overflow-y-auto p-10 bg-background relative h-full">
        {#if activeCategory === "workspace"}
            <WorkspaceSettings />
        {:else if activeCategory === "bibles"}
            <BibleSettings />
        {:else if activeCategory === "display"}
            <RemoteDisplay />
        {:else if activeCategory === "fonts"}
            <FontSettings />
        {:else if activeCategory === "obs"}
            <ObsSettings />
        {:else if activeCategory === "integrations"}
            <Integrations />
        {:else if activeCategory === "about"}
            <div class="max-w-2xl animate-in fade-in duration-300 space-y-4">
                <h1 class="text-2xl font-bold text-foreground mb-2">About</h1>
                <div class="bg-card border border-border rounded-xl p-6">
                    <h2 class="text-lg font-bold text-neon-violet">
                        WorshipCuePro
                    </h2>
                    <p class="text-sm text-muted-foreground mt-1">
                        Version {appVersion}
                        {new Date().getFullYear()}
                    </p>
                    <p class="text-sm text-muted-foreground mt-4">
                        Offline-first presentation that makes you Worship cues
                        seamless.
                    </p>
                </div>
            </div>
        {:else}
            <!-- Placeholders for other tabs -->
            <div class="max-w-2xl animate-in fade-in duration-300">
                <h1 class="text-2xl font-bold text-foreground mb-2 capitalize">
                    {activeCategory.replace("-", " ")}
                </h1>
                <p class="text-sm text-muted-foreground">
                    Settings configuration coming soon...
                </p>
            </div>
        {/if}
    </div>
</div>
