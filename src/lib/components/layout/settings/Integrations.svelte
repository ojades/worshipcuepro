<script lang="ts">
    import { onMount } from "svelte";
    import {
        Key,
        ExternalLink,
        Save,
        Eye,
        EyeOff,
        Loader2,
    } from "@lucide/svelte";
    import Button from "$lib/components/ui/Button.svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import { systemState } from "$lib/state/system.svelte";
    import { open } from "@tauri-apps/plugin-shell";

    let geniusApiKey = $state("");
    let isSaving = $state(false);
    let isLoaded = $state(false);
    let showKey = $state(false);

    onMount(async () => {
        geniusApiKey = await settingsState.getDbSetting("genius_api_key", "");
        isLoaded = true;
    });

    async function saveGeniusKey() {
        isSaving = true;
        const success = await settingsState.setDbSetting(
            "genius_api_key",
            geniusApiKey.trim(),
        );

        if (success) {
            systemState.addAlert({
                message: "Genius API key saved.",
                type: "success",
            });
        } else {
            systemState.addAlert({
                message: "Failed to save API key.",
                type: "error",
            });
        }

        isSaving = false;
    }

    async function openGeniusPortal() {
        await open("https://genius.com/api-clients");
    }
</script>

<div class="max-w-3xl animate-in fade-in duration-300 space-y-8">
    <div>
        <h1 class="text-2xl font-bold text-foreground mb-2">Integrations</h1>
        <p class="text-sm text-muted-foreground">
            Connect WorshipCuePro to external services and APIs.
        </p>
    </div>

    <!-- Genius API Integration -->
    <section class="bg-card border border-border rounded-xl overflow-hidden">
        <div class="p-6 border-b border-border">
            <div class="flex items-center gap-3 mb-2">
                <div class="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg">
                    <Key size={20} />
                </div>
                <h2 class="text-lg font-bold text-foreground">
                    Genius Lyrics API
                </h2>
            </div>
            <p class="text-sm text-muted-foreground">
                Required to search and scrape massive catalogs of song lyrics
                directly into your database.
            </p>
        </div>

        <div class="p-6 space-y-4 bg-background/50">
            {#if !isLoaded}
                <div
                    class="flex items-center gap-2 text-sm text-muted-foreground"
                >
                    <Loader2 size={16} class="animate-spin" /> Loading configuration...
                </div>
            {:else}
                <div class="space-y-2">
                    <label
                        for="genius-key"
                        class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                        Client Access Token
                    </label>
                    <div class="flex gap-2">
                        <div class="relative flex-1 group">
                            <input
                                id="genius-key"
                                type={showKey ? "text" : "password"}
                                bind:value={geniusApiKey}
                                placeholder="Enter your Genius API token..."
                                class="w-full bg-background border border-border rounded-lg pl-4 pr-10 py-2.5 text-sm text-foreground focus:border-neon-violet focus:ring-1 focus:ring-neon-violet transition-colors outline-none"
                            />
                            <button
                                type="button"
                                onclick={() => (showKey = !showKey)}
                                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {#if showKey}
                                    <EyeOff size={16} />
                                {:else}
                                    <Eye size={16} />
                                {/if}
                            </button>
                        </div>

                        <Button
                            variant="primary"
                            onclick={saveGeniusKey}
                            disabled={isSaving}
                            class="px-6"
                        >
                            {#if isSaving}
                                <Loader2 size={16} class="animate-spin mr-2" /> Saving...
                            {:else}
                                <Save size={16} class="mr-2" /> Save
                            {/if}
                        </Button>
                    </div>
                </div>

                <div class="pt-2 flex items-center justify-between text-sm">
                    <p class="text-muted-foreground">
                        Don't have a token? Generate a free API Client.
                    </p>
                    <button
                        onclick={openGeniusPortal}
                        class="flex items-center gap-1.5 text-neon-violet hover:text-neon-cyan transition-colors"
                    >
                        Developer Portal <ExternalLink size={14} />
                    </button>
                </div>
            {/if}
        </div>
    </section>
</div>
