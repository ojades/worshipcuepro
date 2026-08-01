<!-- src/lib/components/layout/HeaderBar.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
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
        AlignVerticalSpaceAround,
        MonitorX, // optional if you want icons next to text later
    } from "@lucide/svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import { formatShortcut, SHORTCUTS } from "$lib/utils/shortcuts";

    let isDisplayMenuOpen = $state(false);
    let { title } = $props<{ title: string }>();

    // Refresh displays on mount
    onMount(async () => {
        try {
            const hardwareDisplays = await fetchSystemDisplays();
            systemState.setDisplays(hardwareDisplays);
        } catch (err) {
            systemState.addAlert({
                message: "Failed to scan system displays.",
                type: "error",
                timeout: 4000,
            });
        }
    });

    // ... handleProjectorToggle and handleStageToggle remain exactly the same ...
    async function handleProjectorToggle() {
        try {
            if (systemState.isProjectorOpen) {
                await closeProjectorWindow();
                systemState.isProjectorOpen = false;
            } else {
                if (!systemState.projectorMonitor) {
                    systemState.addAlert({
                        message:
                            "Please select a monitor for the Projector output.",
                        type: "warning",
                        timeout: 3000,
                    });
                    return;
                }
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
                            "Please select a monitor for the Stage Display.",
                        type: "warning",
                        timeout: 3000,
                    });
                    return;
                }
                await launchStageWindow(systemState.stageMonitor);
                systemState.isStageOpen = true;
            }
        } catch (err) {
            systemState.addAlert({ message: String(err), type: "error" });
        }
    }

    function updateAlignment(alignment: "top" | "middle" | "bottom") {
        settingsState.update({ projectorAlignment: alignment });
        presentation.broadcastState();
    }

    onMount(() => {
        const toggleMenu = () => {
            isDisplayMenuOpen = !isDisplayMenuOpen;
        };
        window.addEventListener("toggle-display-menu", toggleMenu);
        return () =>
            window.removeEventListener("toggle-display-menu", toggleMenu);
    });
</script>

<header
    class="h-14 border-b border-border bg-card/40 backdrop-blur-md px-6 flex items-center justify-between z-50 relative"
>
    <!-- ... Left side titles remain the same ... -->
    <div class="flex flex-col">
        <h1
            class="text-sm font-bold tracking-tight text-foreground/90 uppercase flex items-center gap-2"
        >
            WorshipCuePro - {title} - {presentation.activePlaylist?.name}
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
                <div
                    class="fixed inset-0 z-40"
                    onclick={() => (isDisplayMenuOpen = false)}
                    aria-hidden="true"
                ></div>

                <div
                    class="absolute right-0 top-full mt-3 w-80 bg-card border border-border rounded-xl shadow-2xl p-5 space-y-5 z-[60]"
                >
                    <div>
                        <h2
                            class="text-xs font-bold tracking-wider text-muted-foreground uppercase pb-2 border-b border-border mb-3"
                        >
                            Projector Output
                        </h2>
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-medium text-foreground"
                                >Text Alignment</span
                            >
                            <!-- Segmented Control for Alignment -->
                            <div
                                class="flex bg-background border border-border rounded-lg p-0.5 shadow-inner"
                            >
                                <button
                                    onclick={() => updateAlignment("top")}
                                    class="px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 {settingsState
                                        .config.projectorAlignment === 'top'
                                        ? 'bg-zinc-800 text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'}"
                                >
                                    Top
                                </button>
                                <button
                                    onclick={() => updateAlignment("middle")}
                                    class="px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 {settingsState
                                        .config.projectorAlignment === 'middle'
                                        ? 'bg-zinc-800 text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'}"
                                >
                                    Middle
                                </button>
                                <button
                                    onclick={() => updateAlignment("bottom")}
                                    class="px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 {settingsState
                                        .config.projectorAlignment === 'bottom'
                                        ? 'bg-zinc-800 text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'}"
                                >
                                    Bottom
                                </button>
                            </div>
                        </div>
                    </div>

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
                                {#each systemState.availableForProjector as display}
                                    <option value={display.name}>
                                        {display.name} ({display.width}x{display.height})
                                        {display.is_primary ? "[Primary]" : ""}
                                    </option>
                                {/each}
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
                                {#each systemState.availableForStage as display}
                                    <option value={display.name}>
                                        {display.name} ({display.width}x{display.height})
                                        {display.is_primary ? "[Primary]" : ""}
                                    </option>
                                {/each}
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
