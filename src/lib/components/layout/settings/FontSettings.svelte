<!-- src/lib/components/layout/settings/FontSettings.svelte -->
<script lang="ts">
    import { fontState } from "$lib/state/fonts.svelte";
    import { Upload, Type, HardDrive } from "@lucide/svelte";
</script>

<div class="animate-in fade-in duration-300 w-full max-w-4xl space-y-8">
    <div class="flex items-start justify-between">
        <div>
            <h1 class="text-2xl font-bold text-foreground mb-2">
                Font Management
            </h1>
            <p class="text-sm text-muted-foreground max-w-2xl">
                Import custom fonts to use across your presentations. Fonts are
                saved to your workspace folder, ensuring they sync automatically
                with other devices connected to your Google Drive or Dropbox.
            </p>
        </div>

        <button
            onclick={() => fontState.importFont()}
            class="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background font-semibold rounded-lg text-sm hover:bg-zinc-200 transition-colors shadow-sm"
        >
            <Upload size={16} />
            Import Fonts
        </button>
    </div>

    <!-- Custom Workspace Fonts -->
    <div class="space-y-4">
        <h3
            class="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2"
        >
            <HardDrive size={16} />
            Workspace Fonts
        </h3>

        {#if fontState.customFonts.length === 0}
            <div
                class="bg-card/50 border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3"
            >
                <div class="p-3 bg-zinc-900 rounded-full text-zinc-600">
                    <Type size={24} />
                </div>
                <p class="text-sm text-muted-foreground">
                    No custom fonts imported yet.
                </p>
            </div>
        {:else}
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                {#each fontState.customFonts as font}
                    <div
                        class="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 transition-all hover:border-zinc-700"
                    >
                        <span
                            class="text-lg text-foreground truncate"
                            style="font-family: '{font.family}';"
                        >
                            {font.name}
                        </span>
                        <span
                            class="text-[10px] text-muted-foreground font-mono truncate"
                            title={font.filename}
                        >
                            {font.filename}
                        </span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Built-in System Fonts Reference -->
    <div class="space-y-4 pt-4 border-t border-border">
        <h3
            class="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2"
        >
            System Defaults
        </h3>
        <div class="flex flex-wrap gap-2">
            {#each fontState.systemFonts as sysFont}
                <div
                    class="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-400"
                    style="font-family: '{sysFont}';"
                >
                    {sysFont}
                </div>
            {/each}
        </div>
    </div>
</div>
