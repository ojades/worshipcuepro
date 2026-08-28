<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
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
    import { dev } from "$app/environment";
    import { fontState } from "$lib/state/fonts.svelte";
    import {
        getCoreWorkspaceAPI,
        setCoreWorkspaceAPI,
    } from "$lib/commands/settings-db";
    import { systemState } from "$lib/state/system.svelte";
    import AutoUpdater from "$lib/components/layout/AutoUpdater.svelte";
    import { playlists } from "$lib/state/playlists.svelte";

    let { children } = $props();

    let isAppReady = $state(false);
    let needsSetup = $state(false);
    let initStatus = $state("INITIALIZING ENGINE...");

    let formattedLockOwner = $derived(
        settingsState.lockOwner
            ? settingsState.lockOwner.split("(ID:")[0].trim()
            : "Another Operator",
    );

    async function updateStatus(message: string) {
        initStatus = message.toUpperCase();
        console.log(`[Startup] ${initStatus}`);
        try {
            await emit("app-startup-status", initStatus);
        } catch (e) {
            // Ignore if emit fails
        }
    }

    async function forceBreakLock() {
        await invoke("force_release_lock");
        await invoke("check_and_acquire_lock");
        settingsState.isReadOnly = false;
        settingsState.lockOwner = "";
    }

    async function loadAppResources() {
        try {
            await updateStatus("Loading Settings...");
            await settingsState.init();

            await updateStatus("Verifying Workspace Lock...");
            const lockOwner = await invoke<string>("check_and_acquire_lock");
            const isOffline = await invoke<boolean>("is_db_offline");

            if (isOffline) {
                settingsState.isReadOnly = true;
                settingsState.lockOwner = "(OFFLINE MODE)";
                systemState.addAlert({
                    message:
                        "No internet connection. App is in Read-Only mode to protect cloud data.",
                    type: "warning",
                    timeout: 10000,
                });
            } else if (lockOwner !== "") {
                settingsState.isReadOnly = true;
                settingsState.lockOwner = lockOwner;
            } else {
                settingsState.isReadOnly = false;
            }

            await updateStatus("Loading Libraries...");
            await Promise.all([
                songsState.load(),
                media.loadAll(),
                bibleState.init(),
                shootState.loadAll(),
                fontState.loadFonts(),
                playlists.loadAll(),
            ]);

            // Set UI Ready BEFORE starting heavy background Bible imports!
            isAppReady = true;

            // Background Bible verification & import (Non-blocking)
            setTimeout(async () => {
                try {
                    await bibleState.importXmlBible(NKJV, "NKJV");
                    await bibleState.importSystemBible(NIV);
                    await bibleState.importSystemBible(ERV);
                    await bibleState.importXmlBible(AMPC, "AMPC");
                } catch (err) {
                    console.warn("[Bible] Background import notice:", err);
                }
            }, 1000);

            // Periodically check lock and offline status
            setInterval(async () => {
                if (!settingsState.workspacePath) return;

                const isCurrentlyOffline =
                    await invoke<boolean>("is_db_offline");

                if (isCurrentlyOffline) {
                    if (
                        !settingsState.isReadOnly ||
                        settingsState.lockOwner !== "(OFFLINE MODE)"
                    ) {
                        settingsState.isReadOnly = true;
                        settingsState.lockOwner = "(OFFLINE MODE)";
                        systemState.addAlert({
                            message:
                                "Connection lost. App is in Read-Only mode.",
                            type: "warning",
                            timeout: 8000,
                        });
                    }
                    return; // Skip operator lock check while offline
                }

                // If online, check standard operator lock
                const currentLockOwner = await invoke<string>(
                    "check_and_acquire_lock",
                );

                if (
                    currentLockOwner !== "" &&
                    (!settingsState.isReadOnly ||
                        settingsState.lockOwner === "(OFFLINE MODE)")
                ) {
                    settingsState.isReadOnly = true;
                    settingsState.lockOwner = currentLockOwner;

                    systemState.addAlert({
                        message:
                            "Read-Only mode activated. Another operator took control.",
                        type: "warning",
                        timeout: 8000,
                    });
                } else if (
                    currentLockOwner === "" &&
                    settingsState.isReadOnly
                ) {
                    settingsState.isReadOnly = false;
                    settingsState.lockOwner = "";
                    systemState.addAlert({
                        message: "Online. Lock released!",
                        type: "success",
                        timeout: 8000,
                    });
                }
            }, 15000);
        } catch (error) {
            console.error("Failed to load resources:", error);
            await updateStatus("Error Loading Resources");
        }
    }

    onMount(async () => {
        try {
            let coreWorkspace = await getCoreWorkspaceAPI();

            const legacySettingsStr = localStorage.getItem("wcp_settings");
            const legacyWorkspace = legacySettingsStr
                ? JSON.parse(legacySettingsStr).workspacePath
                : null;

            if (!coreWorkspace && legacyWorkspace) {
                await setCoreWorkspaceAPI(legacyWorkspace);
                coreWorkspace = legacyWorkspace;
            }

            if (coreWorkspace) {
                settingsState.workspacePath = coreWorkspace;

                await updateStatus("Connecting to Database...");
                await loadAppResources();

                setTimeout(async () => {
                    try {
                        await invoke("close_splashscreen");
                    } catch (e) {
                        console.error("Failed to close splash screen:", e);
                    }
                }, 300);
            } else {
                needsSetup = true;
                setTimeout(async () => {
                    try {
                        await invoke("close_splashscreen");
                    } catch (e) {
                        console.error("Failed to close splash screen:", e);
                    }
                }, 300);
            }
        } catch (fatalError) {
            console.error("Critical error during app startup:", fatalError);
            needsSetup = true;
            await invoke("close_splashscreen").catch(console.error);
        }
    });

    async function handleWorkspaceSelected(
        mediaPath: string,
        dbPath: string | null,
    ) {
        await updateStatus("Configuring Workspace...");

        const saveMediaPath = await settingsState.parseWorkspaceDir(mediaPath);
        const saveDbPath = dbPath
            ? await settingsState.parseWorkspaceDir(dbPath)
            : null;

        await setCoreWorkspaceAPI(saveMediaPath, saveDbPath);

        needsSetup = false;

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
    {#if settingsState.isReadOnly}
        <div
            class="absolute top-2 left-1/2 -translate-x-1/2 z-100 animate-in slide-in-from-top-4 fade-in duration-300"
        >
            <div
                class="bg-amber-950/80 backdrop-blur-md border border-amber-500/50 text-amber-400 px-4 py-2 rounded-full flex items-center gap-4 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
            >
                <div
                    class="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase"
                >
                    <span class="text-base">
                        {settingsState.lockOwner === "(OFFLINE MODE)"
                            ? "☁️"
                            : "🔒"}
                    </span>
                    <span>
                        {#if settingsState.lockOwner === "(OFFLINE MODE)"}
                            Offline (Read-Only)
                        {:else}
                            Locked by: {formattedLockOwner}
                        {/if}
                    </span>
                </div>

                {#if settingsState.lockOwner !== "(OFFLINE MODE)"}
                    <div class="w-px h-4 bg-amber-500/30"></div>

                    <button
                        onclick={forceBreakLock}
                        class="text-[10px] bg-amber-500/10 hover:bg-amber-500 hover:text-black px-3 py-1 rounded-full font-bold transition-colors border border-amber-500/30 cursor-pointer"
                        title="Only do this if the other operator's laptop crashed or went offline."
                    >
                        Override
                    </button>
                {/if}
            </div>
        </div>
    {/if}
    <div class="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {@render children()}
    </div>
    <AutoUpdater />
    <Alert />
    <GlobalShortcuts />
{:else}
    <div
        class="h-screen w-screen flex flex-col items-center justify-center bg-[#09090b] text-white"
    >
        <img
            src="/worshipcuepro-logo-sq.png"
            alt="WCP Logo"
            class="w-20 h-20 mb-5 object-contain animate-[pulse_2s_infinite_ease-in-out] scrollbar-none"
        />
        <div
            class="text-[#a1a1aa] text-sm font-medium tracking-[1px] uppercase"
        >
            {initStatus}
        </div>
    </div>
{/if}
