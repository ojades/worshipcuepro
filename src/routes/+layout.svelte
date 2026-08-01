<!-- src/routes/+layout.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import "../app.css";
    import { initDB } from "$lib/db";
    import { settingsState } from "$lib/state/settings.svelte";
    import Alert from "$lib/components/layout/Alert.svelte";
    import { invoke } from "@tauri-apps/api/core";

    import { songsState } from "$lib/state/songs.svelte";
    import { media } from "$lib/state/media.svelte";
    import { bibleState } from "$lib/state/bible.svelte";
    import { shootState } from "$lib/state/shoot.svelte";
    import GlobalShortcuts from "$lib/components/layout/GlobalShortcuts.svelte";
    import OnboardingSetup from "$lib/components/layout/OnboardingSetup.svelte";
    import { Settings } from "@lucide/svelte";

    let { children } = $props();
    let isDbReady = $state(false);
    let needsSetup = $state(false);

    onMount(async () => {
        const savedWorkspace = settingsState.config.workspacePath;
        console.log("Workspace path:", savedWorkspace);

        if (savedWorkspace) {
            isDbReady = await initDB(settingsState.config.workspacePath);

            if (isDbReady) {
                await Promise.all([
                    songsState.load(),
                    media.loadAll(),
                    bibleState.init(),
                    shootState.loadAll(),
                ]);

                // Close splashscreen AFTER everything is loaded
                setTimeout(async () => {
                    try {
                        await invoke("close_splashscreen");
                    } catch (e) {
                        console.error("Failed to close splash screen:", e);
                    }
                }, 500);
            }
        } else {
            needsSetup = true;
            console.log("No workspace path set, showing onboarding setup.");

            // ADD THIS: Close splashscreen so the user can see the setup UI!
            setTimeout(async () => {
                try {
                    await invoke("close_splashscreen");
                } catch (e) {
                    console.error("Failed to close splash screen:", e);
                }
            }, 500);
        }
    });

    async function handleWorkspaceSelected(newPath: string) {
        settingsState.update({ workspacePath: newPath });
        needsSetup = false;
        isDbReady = await initDB(newPath);
    }
</script>

{#if needsSetup}
    <OnboardingSetup onComplete={handleWorkspaceSelected} />
{:else if isDbReady}
    {@render children()}
    <Alert />
    <GlobalShortcuts />
{:else}
    <div
        class="h-screen w-screen flex items-center justify-center bg-black text-white"
    >
        Loading Resources...
    </div>
{/if}
