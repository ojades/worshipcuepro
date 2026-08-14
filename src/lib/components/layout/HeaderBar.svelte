<!-- src/lib/components/layout/HeaderBar.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { systemState } from "$lib/state/system.svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import {
        launchProjectorWindow,
        closeProjectorWindow,
        launchStageWindow,
        closeStageWindow,
        fetchSystemDisplays,
    } from "$lib/commands/display";
    import {
        ChevronDown,
        Eraser,
        Monitor,
        MonitorOff,
        MonitorPlay,
        Power,
        Tv,
        MonitorX,
        ChevronRight,
        X,
    } from "@lucide/svelte";
    import { formatShortcut, SHORTCUTS } from "$lib/utils/shortcuts";

    let isDisplayMenuOpen = $state(false);
    let { title } = $props<{ title: string }>();

    // Polling State
    let displayPollInterval: ReturnType<typeof setInterval>;
    let previousDisplayCount = $state(0);
    let hasInitializedDisplays = $state(false);

    // --- NEW: Filter out the Primary Display to protect the operator ---
    let externalProjectorDisplays = $derived(
        systemState.availableForProjector.filter((d) => !d.is_primary),
    );
    let externalStageDisplays = $derived(
        systemState.availableForStage.filter((d) => !d.is_primary),
    );

    onMount(() => {
        // --- DYNAMIC DISPLAY POLLING & AUTO-CONNECT ---
        const pollDisplays = async () => {
            try {
                const hardwareDisplays = await fetchSystemDisplays();

                // Detect if a new monitor was just plugged in (or if we booted with one)
                const isInitialBootWithExternal =
                    !hasInitializedDisplays && hardwareDisplays.length > 1;
                // Use < instead of === 1 so it seamlessly handles 1->2, 2->3, etc.
                const isNewlyAttached =
                    hasInitializedDisplays &&
                    previousDisplayCount < hardwareDisplays.length;

                // This handles the smart auto-assignment via SystemState
                systemState.setDisplays(hardwareDisplays);

                // --- CLEANUP ORPHANED WINDOWS ---
                // If a display dropped, Tauri moves the window to the primary screen.
                // We MUST explicitly close it so it doesn't block the operator's view.
                if (
                    systemState.isProjectorOpen &&
                    !systemState.projectorMonitor
                ) {
                    await closeProjectorWindow().catch(() => {});
                    systemState.isProjectorOpen = false;
                }
                if (systemState.isStageOpen && !systemState.stageMonitor) {
                    await closeStageWindow().catch(() => {});
                    systemState.isStageOpen = false;
                }

                // --- AUTO-LAUNCH PROJECTOR ---
                if (
                    (isInitialBootWithExternal || isNewlyAttached) &&
                    !systemState.isProjectorOpen &&
                    systemState.projectorMonitor
                ) {
                    try {
                        // Force close just in case a ghost window from a previous session exists
                        await closeProjectorWindow().catch(() => {});

                        await launchProjectorWindow(
                            systemState.projectorMonitor,
                        );
                        systemState.isProjectorOpen = true;

                        systemState.addAlert({
                            message: `Projector auto-connected to external display.`,
                            type: "success",
                            timeout: 3000,
                        });
                    } catch (launchErr) {
                        console.error("Auto-launch failed:", launchErr);
                    }
                }

                previousDisplayCount = hardwareDisplays.length;
                hasInitializedDisplays = true;
            } catch (err) {
                // Silently catch polling errors so we don't spam the UI if Tauri hiccups
                console.error("Display poll error:", err);
            }
        };

        // Run immediately, then every 3 seconds
        pollDisplays();
        displayPollInterval = setInterval(pollDisplays, 3000);

        // Menu Toggle Event
        const toggleMenu = () => {
            isDisplayMenuOpen = !isDisplayMenuOpen;
        };
        window.addEventListener("toggle-display-menu", toggleMenu);

        return () => {
            clearInterval(displayPollInterval);
            window.removeEventListener("toggle-display-menu", toggleMenu);
        };
    });

    async function handleProjectorToggle() {
        try {
            if (systemState.isProjectorOpen) {
                await closeProjectorWindow();
                systemState.isProjectorOpen = false;
            } else {
                if (!systemState.projectorMonitor) {
                    systemState.addAlert({
                        message:
                            "Please select an external monitor for the Projector output.",
                        type: "warning",
                        timeout: 3000,
                    });
                    return;
                }

                // Destroy any lingering ghost windows before launching
                await closeProjectorWindow().catch(() => {});

                await launchProjectorWindow(systemState.projectorMonitor);
                systemState.isProjectorOpen = true;
            }
        } catch (err) {
            systemState.addAlert({ message: String(err), type: "error" });
        }
    }

    async function handleStageToggle() {
        try {
            if (systemState.isStageOpen) {
                await closeStageWindow();
                systemState.isStageOpen = false;
            } else {
                if (!systemState.stageMonitor) {
                    systemState.addAlert({
                        message:
                            "Please select an external monitor for the Stage Display.",
                        type: "warning",
                        timeout: 3000,
                    });
                    return;
                }

                // Destroy any lingering ghost windows before launching
                await closeStageWindow().catch(() => {});

                await launchStageWindow(systemState.stageMonitor);
                systemState.isStageOpen = true;
            }
        } catch (err) {
            systemState.addAlert({ message: String(err), type: "error" });
        }
    }
</script>

<header
    class="h-14 border-b border-border bg-card/40 backdrop-blur-md px-6 flex items-center justify-between z-50 relative"
>
    <div class="flex items-center select-none">
        <h1
            class="flex items-center text-sm font-bold tracking-tight uppercase"
        >
            <!-- Brand Name -->
            <div class="flex items-center">
                <span class="text-foreground/90">WorshipCue</span>
                <span class="text-neon-violet">Pro</span>
            </div>

            <!-- Page Title -->
            <ChevronRight
                size={14}
                strokeWidth={3}
                class="mx-2 text-muted-foreground/70"
            />
            <span class="text-muted-foreground">{title}</span>

            <!-- Active Playlist Pill -->
            {#if presentation.activePlaylist}
                <ChevronRight
                    size={14}
                    strokeWidth={3}
                    class="mx-2 text-muted-foreground/70"
                />
                <div
                    class="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-md pl-3 pr-1 py-1 shadow-sm"
                >
                    <div
                        class="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"
                    ></div>
                    <span
                        class="text-neon-cyan text-xs font-bold tracking-widest mt-px"
                    >
                        {presentation.activePlaylist.name}
                    </span>
                    <button
                        onclick={() => (presentation.activePlaylist = null)}
                        class="ml-1 p-0.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                        title="Unmount Playlist"
                    >
                        <X size={14} strokeWidth={2.5} />
                    </button>
                </div>
            {/if}
        </h1>
    </div>

    <!-- Action Status Toggles & Settings -->
    <div class="flex items-center gap-2">
        <!-- Clear Active Cue Button -->
        <button
            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer text-muted-foreground hover:bg-muted/50 hover:text-red-400"
            onclick={() => presentation.clearActiveCue()}
            title="Clear Active Cue ({formatShortcut(SHORTCUTS.CLEAR_CUE)})"
        >
            <MonitorX size={20} strokeWidth={2} />
        </button>
        <!-- Clear Text Icon Button -->
        <button
            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer
                {presentation.isTextCleared
                ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
            onclick={() => presentation.toggleClearText()}
            title="Clear Text ({formatShortcut(SHORTCUTS.CLEAR_TEXT)})"
            aria-label="Clear Text"
        >
            <Eraser size={20} strokeWidth={2} />
        </button>

        <!-- Blackout Icon Button -->
        <button
            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer
                {presentation.isBlackout
                ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
            onclick={() => presentation.toggleBlackout()}
            title="Blackout ({formatShortcut(SHORTCUTS.BLACKOUT)})"
            aria-label="Blackout"
        >
            <MonitorOff size={20} strokeWidth={2} />
        </button>

        <div class="w-px h-6 bg-border mx-1"></div>

        <!-- Display Settings Menu Toggle -->
        <div class="relative">
            <button
                class="h-10 px-3 rounded-xl flex items-center gap-2 transition-all duration-200 cursor-pointer border
                {isDisplayMenuOpen ||
                systemState.isProjectorOpen ||
                systemState.isStageOpen
                    ? 'bg-neon-violet/10 border-neon-violet/30 text-neon-violet'
                    : 'bg-transparent border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
                onclick={() => (isDisplayMenuOpen = !isDisplayMenuOpen)}
                title="Display Settings ({formatShortcut(
                    SHORTCUTS.DISPLAY_MENU,
                )})"
            >
                <Monitor size={20} strokeWidth={2} />
                <ChevronDown
                    size={14}
                    class="opacity-70 transition-transform duration-200 {isDisplayMenuOpen
                        ? 'rotate-180'
                        : ''}"
                />
            </button>

            <!-- Dropdown Menu -->
            {#if isDisplayMenuOpen}
                <!-- Invisible backdrop to close menu when clicking outside -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="fixed inset-0 z-40 h-screen"
                    onclick={() => (isDisplayMenuOpen = false)}
                    aria-hidden="true"
                ></div>

                <div
                    class="absolute right-0 top-full mt-3 w-80 bg-card border border-border rounded-xl shadow-2xl p-5 space-y-5 z-[60]"
                >
                    <!-- External Displays Settings -->
                    <div>
                        <h2
                            class="text-xs font-bold tracking-wider text-muted-foreground uppercase pb-2 border-b border-border mb-3"
                        >
                            Hardware Displays
                        </h2>

                        <!-- 1. Projector Assignment & Control -->
                        <div class="space-y-3 mb-5">
                            <div class="flex items-center justify-between">
                                <h3
                                    class="text-sm font-semibold text-foreground flex items-center gap-1.5"
                                >
                                    <MonitorPlay
                                        size={16}
                                        class="text-neon-violet"
                                    />
                                    Audience Projector
                                </h3>
                                <div class="flex items-center gap-1.5">
                                    <div
                                        class="w-2 h-2 rounded-full transition-all duration-300 {systemState.isProjectorOpen
                                            ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                                            : 'bg-muted'}"
                                    ></div>
                                </div>
                            </div>

                            <select
                                disabled={systemState.isProjectorOpen}
                                value={systemState.projectorMonitor ?? ""}
                                onchange={(e) =>
                                    systemState.assignProjector(
                                        e.currentTarget.value,
                                    )}
                                class="w-full text-xs bg-background text-foreground border border-border rounded-lg px-2.5 py-1.5 focus:border-neon-violet focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                <option value="">-- Unassigned --</option>
                                {#each externalProjectorDisplays as display}
                                    <option value={display.name}>
                                        {display.name} ({display.width}x{display.height})
                                    </option>
                                {/each}
                                {#if externalProjectorDisplays.length === 0}
                                    <option value="" disabled
                                        >No external displays found</option
                                    >
                                {/if}
                            </select>

                            <button
                                onclick={handleProjectorToggle}
                                disabled={!systemState.isProjectorOpen &&
                                    !systemState.projectorMonitor}
                                class="w-full font-semibold py-2 px-4 rounded-lg text-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed {systemState.isProjectorOpen
                                    ? 'bg-background hover:bg-zinc-800 text-red-400 border border-border'
                                    : 'bg-neon-violet hover:bg-neon-violet-dark text-white'}"
                            >
                                <Power size={14} />
                                {systemState.isProjectorOpen
                                    ? "Disconnect Projector"
                                    : "Launch Projector"}
                            </button>
                        </div>

                        <!-- 2. Stage Display Assignment & Control -->
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <h3
                                    class="text-sm font-semibold text-foreground flex items-center gap-1.5"
                                >
                                    <Tv size={16} class="text-neon-cyan" />
                                    Stage Monitor
                                </h3>
                                <div class="flex items-center gap-1.5">
                                    <div
                                        class="w-2 h-2 rounded-full transition-all duration-300 {systemState.isStageOpen
                                            ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                                            : 'bg-muted'}"
                                    ></div>
                                </div>
                            </div>

                            <select
                                disabled={systemState.isStageOpen}
                                value={systemState.stageMonitor ?? ""}
                                onchange={(e) =>
                                    systemState.assignStage(
                                        e.currentTarget.value,
                                    )}
                                class="w-full text-xs bg-background text-foreground border border-border rounded-lg px-2.5 py-1.5 focus:border-neon-cyan focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                <option value="">-- Unassigned --</option>
                                {#each externalStageDisplays as display}
                                    <option value={display.name}>
                                        {display.name} ({display.width}x{display.height})
                                    </option>
                                {/each}
                                {#if externalStageDisplays.length === 0}
                                    <option value="" disabled
                                        >No external displays found</option
                                    >
                                {/if}
                            </select>

                            <button
                                onclick={handleStageToggle}
                                disabled={!systemState.isStageOpen &&
                                    !systemState.stageMonitor}
                                class="w-full font-semibold py-2 px-4 rounded-lg text-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed {systemState.isStageOpen
                                    ? 'bg-background hover:bg-zinc-800 text-red-400 border border-border'
                                    : 'bg-neon-cyan text-background hover:bg-neon-cyan/90'}"
                            >
                                <Power size={14} />
                                {systemState.isStageOpen
                                    ? "Disconnect Stage"
                                    : "Launch Stage"}
                            </button>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</header>
