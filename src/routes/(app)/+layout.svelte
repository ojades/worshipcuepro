<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import { initDB } from "$lib/db";
    import { settingsState } from "$lib/state/settings.svelte";
    import Alert from "$lib/components/layout/Alert.svelte";
    import { invoke } from "@tauri-apps/api/core";
    import { emit } from "@tauri-apps/api/event";
    import NKJV from "$lib/data/bibles/NKJV.json";
    import NIV from "$lib/data/bibles/NIV.json";
    import ERV from "$lib/data/bibles/ERV.json";

    import { songsState } from "$lib/state/songs.svelte";
    import { media } from "$lib/state/media.svelte";
    import { bibleState } from "$lib/state/bible.svelte";
    import { shootState } from "$lib/state/shoot.svelte";
    import GlobalShortcuts from "$lib/components/layout/GlobalShortcuts.svelte";
    import OnboardingSetup from "$lib/components/layout/OnboardingSetup.svelte";
    import { exists } from "@tauri-apps/plugin-fs";
    import { dev } from "$app/environment";

    let { children } = $props();

    let isDbReady = $state(false);
    let isAppReady = $state(false);
    let needsSetup = $state(false);
    let initStatus = $state("INITIALIZING ENGINE...");

    // Updates the Svelte state and attempts to dispatch to the Splash Screen window
    async function updateStatus(message: string) {
        initStatus = message.toUpperCase();
        console.log(`[Startup] ${initStatus}`);
        try {
            await emit("app-startup-status", initStatus);
        } catch (e) {
            // Ignore if emit fails or splash is already closed
        }
    }

    // DRY function to load everything
    async function loadAppResources() {
        try {
            await updateStatus("Importing NKJV...");
            await bibleState.importSystemBible(NKJV);

            await updateStatus("Importing NIV...");
            await bibleState.importSystemBible(NIV);

            await updateStatus("Importing ERV...");
            await bibleState.importSystemBible(ERV);

            await updateStatus("Loading Libraries...");
            await Promise.all([
                songsState.load(),
                media.loadAll(),
                bibleState.init(),
                shootState.loadAll(),
            ]);

            isAppReady = true;
        } catch (error) {
            console.error("Failed to load resources:", error);
            await updateStatus("Error Loading Resources");
        }
    }

    onMount(async () => {
        const savedWorkspace = settingsState.config.workspacePath as string;
        const dirExists = await exists(savedWorkspace);

        if (savedWorkspace && dirExists) {
            await updateStatus("Connecting to Database...");
            isDbReady = await initDB(savedWorkspace);

            if (isDbReady) {
                await loadAppResources();
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
            // Close splash screen immediately so user can see onboarding UI
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
        // Parse path and save
        const savePath = await settingsState.parseWorkspaceDir(newPath);
        settingsState.update({ workspacePath: savePath });

        // Hide setup screen immediately so the user sees the Svelte loading state
        needsSetup = false;

        await updateStatus("Connecting to Database...");
        isDbReady = await initDB(savePath);

        if (isDbReady) {
            await loadAppResources();
        }
    }
</script>

<svelte:window
    oncontextmenu={(e) => {
        if (!dev) {
            e.preventDefault();
        }
    }}
/>

{#if needsSetup}
    <OnboardingSetup onComplete={handleWorkspaceSelected} />
{:else if isAppReady}
    {@render children()}
    <Alert />
    <GlobalShortcuts />
{:else}
    <!-- This visually mimics the Tauri splash screen for when we load during onboarding -->
    <div
        class="h-screen w-screen flex flex-col items-center justify-center bg-[#09090b] text-white"
    >
        <img
            src="/worshipcuepro-logo-sq.png"
            alt="WCP Logo"
            class="w-20 h-20 mb-5 object-contain animate-[pulse_2s_infinite_ease-in-out]"
        />
        <div
            class="text-[#a1a1aa] text-sm font-medium tracking-[1px] uppercase"
        >
            {initStatus}
        </div>
    </div>
{/if}
