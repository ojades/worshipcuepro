<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import { initDB } from "$lib/db";
    import { settingsState } from "$lib/state/settings.svelte";
    import Alert from "$lib/components/layout/Alert.svelte";
    import { invoke } from "@tauri-apps/api/core";
    import { emit } from "@tauri-apps/api/event";
    import { relaunch } from "@tauri-apps/plugin-process";

    import NIV from "$lib/data/bibles/NIV.json";
    import ERV from "$lib/data/bibles/ERV.json";
    import AMPC from "$lib/data/bibles/AMPC.xml?raw";
    import NKJV from "$lib/data/bibles/NKJV.xml?raw";

    import { songsState } from "$lib/state/songs.svelte";
    import { media } from "$lib/state/media.svelte";
    import { bibleState } from "$lib/state/bible.svelte";
    import { shootState } from "$lib/state/shoot.svelte";
    import GlobalShortcuts from "$lib/components/layout/GlobalShortcuts.svelte";
    import OnboardingSetup from "$lib/components/layout/OnboardingSetup.svelte";
    import { exists } from "@tauri-apps/plugin-fs";
    import { dev } from "$app/environment";
    import { fontState } from "$lib/state/fonts.svelte";
    import {
        getCoreWorkspaceAPI,
        setCoreWorkspaceAPI,
    } from "$lib/commands/settings-db";

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
            await bibleState.importXmlBible(NKJV, "NKJV");

            await updateStatus("Importing NIV...");
            await bibleState.importSystemBible(NIV);

            await updateStatus("Importing ERV...");
            await bibleState.importSystemBible(ERV);

            await updateStatus("Importing AMPC...");
            await bibleState.importXmlBible(AMPC, "AMPC");

            await updateStatus("Loading Libraries...");
            await Promise.all([
                songsState.load(),
                media.loadAll(),
                bibleState.init(),
                shootState.loadAll(),
                fontState.loadFonts(),
            ]);

            isAppReady = true;
        } catch (error) {
            console.error("Failed to load resources:", error);
            await updateStatus("Error Loading Resources");
        }
    }

    onMount(async () => {
        try {
            let needRestart = false;
            // 1. Check Rust for the definitive Core Workspace path
            let coreWorkspace = await getCoreWorkspaceAPI();

            // 2. MIGRATION: If Rust has no workspace, but localStorage does, migrate it.
            const legacyWorkspace = settingsState.config?.workspacePath;

            if (!coreWorkspace && legacyWorkspace) {
                console.log(
                    "[Migration] Moving workspace path from localStorage to Rust Core Config...",
                );
                await setCoreWorkspaceAPI(legacyWorkspace);
                coreWorkspace = legacyWorkspace;

                const newSettings = { ...settingsState.config };
                delete newSettings.workspacePath;
                settingsState.update(newSettings);

                // Flag for restart ONLY if we migrated, so Rust connects to the new path
                needRestart = true;
            }

            let dirExists = false;

            // Safely check if the directory exists
            if (coreWorkspace) {
                try {
                    dirExists = await exists(coreWorkspace);
                    // (Removed the bug here that forced needRestart = true on every startup)
                } catch (fsError) {
                    console.warn("Workspace check failed:", fsError);
                    dirExists = false;
                }
            }

            if (coreWorkspace && dirExists) {
                if (needRestart) {
                    await updateStatus("Applying settings...");
                    await relaunch(); // Instantly restarts the app automatically!
                    return;
                }

                await updateStatus("Connecting to Database...");
                await loadAppResources();

                setTimeout(async () => {
                    try {
                        await invoke("close_splashscreen");
                    } catch (e) {
                        console.error("Failed to close splash screen:", e);
                    }
                }, 500);
            } else {
                // No workspace found in Rust OR legacy JS. Show setup.
                needsSetup = true;
                setTimeout(async () => {
                    try {
                        await invoke("close_splashscreen");
                    } catch (e) {
                        console.error("Failed to close splash screen:", e);
                    }
                }, 500);
            }
        } catch (fatalError) {
            console.error("Critical error during app startup:", fatalError);
            needsSetup = true;
            await invoke("close_splashscreen").catch(console.error);
        }
    });

    async function handleWorkspaceSelected(newPath: string) {
        await updateStatus("Configuring Workspace...");
        const savePath = await settingsState.parseWorkspaceDir(newPath);

        // 1. Save strictly to Rust Core Config
        await setCoreWorkspaceAPI(savePath);

        needsSetup = false;

        // Use Tauri's built-in relaunch function instead of an annoying alert
        await updateStatus("Restarting engine...");
        await relaunch();
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
