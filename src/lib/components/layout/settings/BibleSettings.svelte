<!-- /src/lib/components/layout/settings/BibleSettings.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import { bibleState } from "$lib/state/bible.svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Search from "@lucide/svelte/icons/search";
    import Button from "$lib/components/ui/Button.svelte";
    import { RefreshCw, Trash2 } from "@lucide/svelte";

    let searchQuery = $state("");

    // --- Inline Delete State ---
    let pendingDeleteId = $state<string | null>(null);

    onMount(() => {
        if (bibleState.versions.length === 0) {
            bibleState.loadVersions();
        }

        // Initialize default enabled bibles if not set in config
        if (
            !settingsState.config.enabledBibles ||
            settingsState.config.enabledBibles.length === 0
        ) {
            settingsState.update({
                enabledBibles: [
                    "ab_de4e12af7f28f599-01",
                    "ab_d6e14a625393b4da-01",
                    "ab_06125adad2d5898a-01",
                    "ab_6f11a7de016f942e-01",
                    "ab_63097d2a0a2f7db3-01",
                ].map((v) => v),
            });
        }
    });

    let enabledBibles = $derived(settingsState.config.enabledBibles || []);

    // Filter AND Sort: Enabled Bibles float to the top
    let filteredVersions = $derived(
        bibleState.versions
            .filter(
                (v) =>
                    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (v.abbreviation &&
                        v.abbreviation
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())),
            )
            .sort((a, b) => {
                const aEnabled = enabledBibles.includes(a.id);
                const bEnabled = enabledBibles.includes(b.id);

                // If one is enabled and the other isn't, the enabled one goes first
                if (aEnabled && !bEnabled) return -1;
                if (!aEnabled && bEnabled) return 1;

                // Otherwise, sort them alphabetically
                return a.name.localeCompare(b.name);
            }),
    );

    function toggleBible(id: string) {
        let updated: string[];
        if (enabledBibles.includes(id)) {
            updated = enabledBibles.filter((bId) => bId !== id);
        } else {
            updated = [...enabledBibles, id];
        }
        settingsState.update({ enabledBibles: updated });
    }

    async function confirmDelete(id: string) {
        // Uncheck it from enabled list if it was active
        if (enabledBibles.includes(id)) {
            toggleBible(id);
        }
        await bibleState.deleteSystemBible(id);
        pendingDeleteId = null; // Reset inline state
    }
</script>

<div
    class="max-w-2xl space-y-8 animate-in fade-in duration-300 flex flex-col h-full pb-10"
>
    <!-- Header -->
    <div class="shrink-0">
        <h1 class="text-2xl font-bold text-foreground mb-2">
            Bible Translations
        </h1>
        <p class="text-sm text-muted-foreground">
            Manage which Bible translations are visible to the operator in the
            live interface. Disabling a translation hides it from the dropdown
            but does not delete it.
        </p>
    </div>

    <!-- Search & Controls -->
    <div class="flex items-center gap-3 shrink-0">
        <!-- Search Input -->
        <div class="relative flex-1">
            <Search
                size={16}
                class="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500"
            />
            <input
                type="text"
                placeholder="Search translations (e.g., 'KJV' or 'King James')..."
                bind:value={searchQuery}
                class="w-full bg-zinc-900 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-neon-violet focus:ring-1 focus:ring-neon-violet transition-colors outline-none"
            />
        </div>

        <!-- Refresh Button -->
        <Button
            disabled={bibleState.isLoading}
            onclick={() => bibleState.refreshVersions()}
            class="shrink-0 bg-neon-violet-dark hover:bg-neon-violet-dark/20 text-zinc-200 border border-border transition-colors"
        >
            <RefreshCw
                size={16}
                class="mr-2 {bibleState.isLoading
                    ? 'animate-spin text-neon-violet'
                    : ''}"
            />
            {bibleState.isLoading ? "Updating..." : "Check for Updates"}
        </Button>
    </div>

    <!-- Translations List -->
    <div
        class="flex-1 overflow-y-auto bg-card border border-border rounded-xl shadow-sm custom-scrollbar"
    >
        {#if bibleState.isLoading && bibleState.versions.length === 0}
            <div class="h-32 flex items-center justify-center">
                <Loader2 size={24} class="text-neon-violet animate-spin" />
            </div>
        {:else if filteredVersions.length === 0}
            <div
                class="h-32 flex flex-col items-center justify-center text-zinc-500 text-sm"
            >
                <p>No translations found.</p>
            </div>
        {:else}
            <div class="divide-y divide-border">
                {#each filteredVersions as version (version.id)}
                    {@const isEnabled = enabledBibles.includes(version.id)}
                    {@const isDeleting = pendingDeleteId === version.id}
                    <div
                        class="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors {isEnabled
                            ? 'bg-zinc-900/40'
                            : ''}"
                    >
                        <div class="flex flex-col gap-0.5">
                            <span
                                class="text-sm font-semibold flex items-center gap-2 {isEnabled
                                    ? 'text-foreground'
                                    : 'text-zinc-400'}"
                            >
                                {version.name}
                                {#if version.provider === "system"}
                                    <span
                                        class="text-[10px] bg-zinc-800 {isEnabled
                                            ? 'text-zinc-300'
                                            : 'text-zinc-500'} px-1.5 py-0.5 rounded font-bold uppercase tracking-widest"
                                        >Local</span
                                    >
                                {/if}
                            </span>
                            {#if version.abbreviation}
                                <span
                                    class="text-xs text-muted-foreground font-medium uppercase tracking-wider"
                                >
                                    {version.abbreviation}
                                </span>
                            {/if}
                        </div>

                        <!-- Action Controls -->
                        <div class="flex items-center gap-4 shrink-0 h-8">
                            <!-- Inline Delete Confirmation -->
                            {#if isDeleting}
                                <div
                                    class="flex items-center gap-2 animate-in slide-in-from-right-4 duration-200"
                                >
                                    <span
                                        class="text-xs text-red-400 font-medium mr-1"
                                        >Delete permanently?</span
                                    >
                                    <button
                                        onclick={() => (pendingDeleteId = null)}
                                        class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-semibold transition-colors"
                                        disabled={bibleState.isLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onclick={() =>
                                            confirmDelete(version.id)}
                                        class="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold transition-colors"
                                        disabled={bibleState.isLoading}
                                    >
                                        Yes, Delete
                                    </button>
                                </div>
                            {:else}
                                <div
                                    class="flex items-center gap-4 animate-in fade-in duration-200"
                                >
                                    <!-- Show Delete Button ONLY for System/Local Bibles -->
                                    {#if version.provider === "system"}
                                        <button
                                            onclick={() =>
                                                (pendingDeleteId = version.id)}
                                            class="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                            title="Delete Imported Translation"
                                            disabled={bibleState.isLoading}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    {/if}

                                    <!-- Stylish Toggle Switch -->
                                    <button
                                        role="switch"
                                        aria-checked={isEnabled}
                                        onclick={() => toggleBible(version.id)}
                                        class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-neon-violet focus:ring-offset-2 focus:ring-offset-background {isEnabled
                                            ? 'bg-neon-violet'
                                            : 'bg-zinc-700'}"
                                    >
                                        <span class="sr-only"
                                            >Toggle {version.name}</span
                                        >
                                        <span
                                            aria-hidden="true"
                                            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {isEnabled
                                                ? 'translate-x-5'
                                                : 'translate-x-0'}"
                                        ></span>
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
