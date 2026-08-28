<!-- /src/lib/components/layout/settings/WorkspaceSettings.svelte -->
<script lang="ts">
    import { open, save } from "@tauri-apps/plugin-dialog";
    import { writeTextFile, readTextFile, exists } from "@tauri-apps/plugin-fs";
    import { appDataDir } from "@tauri-apps/api/path";
    import { systemState } from "$lib/state/system.svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import { relaunch } from "@tauri-apps/plugin-process";

    import Cloud from "@lucide/svelte/icons/cloud";
    import Database from "@lucide/svelte/icons/database";
    import Info from "@lucide/svelte/icons/info";
    import Eraser from "@lucide/svelte/icons/eraser";
    import Download from "@lucide/svelte/icons/download";
    import Upload from "@lucide/svelte/icons/upload";
    import SettingsIcon from "@lucide/svelte/icons/settings";
    import { setCoreWorkspaceAPI } from "$lib/commands/settings-db";
    import { onMount } from "svelte";
    import { DatabaseZap, Trash2 } from "@lucide/svelte";

    let workspacePath = $derived(settingsState.workspacePath);
    let dbPath = $state<string | null>(null);
    let tursoUrl = $state<string>("");
    let tursoToken = $state<string>("");
    let isTursoActive = $derived(tursoUrl.trim().length > 0);

    // Confirmation state for clearing cache
    let confirmClear = $state(false);
    let clearTimer: ReturnType<typeof setTimeout>;

    onMount(async () => {
        try {
            // Resolve the AppData path using Tauri API path resolver
            const dirPath = await appDataDir();
            const configFilePath = `${dirPath}/wcp_core.json`;

            const fileExists = await exists(configFilePath);
            if (fileExists) {
                const configStr = await readTextFile(configFilePath);
                if (configStr) {
                    const config = JSON.parse(configStr);
                    dbPath = config.db_path || null;
                    tursoUrl = config.turso_url || "";
                    tursoToken = config.turso_token || "";
                }
            }
        } catch (e) {
            console.error("Failed to load core config:", e);
        }
    });

    async function handleSelectWorkspace() {
        try {
            const selectedDir = await open({
                directory: true,
                multiple: false,
                title: "Select Media/Fonts Workspace Folder",
            });

            if (selectedDir && typeof selectedDir === "string") {
                const savePath =
                    await settingsState.parseWorkspaceDir(selectedDir);
                await setCoreWorkspaceAPI(
                    savePath,
                    dbPath,
                    tursoUrl,
                    tursoToken,
                );
                await relaunch();
            }
        } catch (error) {
            systemState.addAlert({
                message: "Failed to set new workspace directory.",
                type: "error",
            });
        }
    }

    async function handleSelectDatabase() {
        try {
            const selectedDir = await open({
                directory: true,
                multiple: false,
                title: "Select Local Database Location (e.g. Dropbox)",
            });

            if (selectedDir && typeof selectedDir === "string") {
                const saveDbPath =
                    await settingsState.parseWorkspaceDir(selectedDir);
                await setCoreWorkspaceAPI(
                    settingsState.workspacePath,
                    saveDbPath,
                    tursoUrl,
                    tursoToken,
                );
                await relaunch();
            }
        } catch (error) {
            systemState.addAlert({
                message: "Failed to set new database directory.",
                type: "error",
            });
        }
    }

    async function handleSaveTurso() {
        try {
            await setCoreWorkspaceAPI(
                settingsState.workspacePath,
                dbPath,
                tursoUrl.trim(),
                tursoToken.trim(),
            );
            await relaunch();
        } catch (error) {
            systemState.addAlert({
                message: "Failed to save Turso config.",
                type: "error",
            });
        }
    }

    async function handleClearTurso() {
        try {
            tursoUrl = "";
            tursoToken = "";
            await setCoreWorkspaceAPI(
                settingsState.workspacePath,
                dbPath,
                "",
                "",
            );
            await relaunch();
        } catch (error) {
            systemState.addAlert({
                message: "Failed to clear Turso config.",
                type: "error",
            });
        }
    }

    async function handleResetWorkspace() {
        try {
            const defaultPath = await settingsState.parseWorkspaceDir("");
            await setCoreWorkspaceAPI(defaultPath);
            await relaunch();
        } catch (error) {
            systemState.addAlert({
                message: "Failed to reset workspace.",
                type: "error",
            });
        }
    }

    function handleClearCache() {
        if (!confirmClear) {
            confirmClear = true;
            clearTimer = setTimeout(() => {
                confirmClear = false;
            }, 3000);
        } else {
            clearTimeout(clearTimer);
            confirmClear = false;
            settingsState.clearLocalCache();
            systemState.addAlert({
                message: "Local cache cleared and settings reset.",
                type: "success",
            });
        }
    }

    async function handleExportSettings() {
        try {
            const filePath = await save({
                title: "Export Settings",
                defaultPath: "worshipcuepro_settings.json",
                filters: [{ name: "JSON", extensions: ["json"] }],
            });

            if (filePath) {
                const settingsData = settingsState.exportSettings();
                await writeTextFile(filePath, settingsData);
                systemState.addAlert({
                    message: "Settings exported successfully.",
                    type: "success",
                });
            }
        } catch (error) {
            console.error("Export settings error:", error);
            systemState.addAlert({
                message: "Failed to export settings.",
                type: "error",
            });
        }
    }

    async function handleImportSettings() {
        try {
            const selected = await open({
                multiple: false,
                title: "Import Settings",
                filters: [{ name: "JSON", extensions: ["json"] }],
            });

            if (selected && typeof selected === "string") {
                const jsonString = await readTextFile(selected);
                const success = settingsState.importSettings(jsonString);

                if (success) {
                    systemState.addAlert({
                        message: "Settings imported successfully.",
                        type: "success",
                    });
                } else {
                    systemState.addAlert({
                        message: "Invalid settings file format.",
                        type: "error",
                    });
                }
            }
        } catch (error) {
            console.error("Import settings error:", error);
            systemState.addAlert({
                message: "Failed to import settings.",
                type: "error",
            });
        }
    }
</script>

<div class="max-w-2xl space-y-8 animate-in fade-in duration-300 pb-12">
    <div>
        <h1 class="text-2xl font-bold text-foreground mb-2">
            Workspace & Sync
        </h1>
        <p class="text-sm text-muted-foreground leading-relaxed">
            Select shared folders on your computer to store your database and
            media files. For best results, use a local sync tool like Syncthing
            for Media, and <strong class="text-foreground"
                >Turso Cloud Sync</strong
            > for real-time multi-device database synchronization.
        </p>
    </div>

    <!-- Active Workspace Card -->
    <div
        class="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm"
    >
        <!-- Media Path -->
        <div class="flex items-start gap-4">
            <div class="p-3 bg-neon-cyan/10 text-neon-cyan rounded-lg">
                <Cloud size={24} />
            </div>
            <div class="space-y-2 flex-1">
                <div class="flex items-center justify-between">
                    <h3 class="font-semibold text-foreground">
                        Resources Location
                    </h3>
                    <button
                        onclick={handleSelectWorkspace}
                        class="text-xs font-bold uppercase text-neon-cyan hover:text-white transition-colors cursor-pointer"
                        >Change</button
                    >
                </div>
                <p
                    class="text-xs text-muted-foreground font-mono bg-background border border-border p-2 rounded-md break-all"
                >
                    {workspacePath ||
                        "No workspace selected. Using default local storage."}
                </p>
            </div>
        </div>

        <!-- Turso Cloud database card -->
        <div
            class="bg-card border {isTursoActive
                ? 'border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]'
                : 'border-border'} rounded-xl p-6 shadow-sm flex flex-col gap-4 transition-all"
        >
            <div class="flex items-start gap-4">
                <div
                    class="p-3 {isTursoActive
                        ? 'bg-violet-500/20 text-violet-400'
                        : 'bg-zinc-800 text-zinc-400'} rounded-lg transition-colors"
                >
                    <DatabaseZap size={24} />
                </div>
                <div class="space-y-1 flex-1">
                    <div class="flex items-center justify-between">
                        <h3 class="font-semibold text-foreground">
                            Turso Cloud Sync
                        </h3>
                        {#if isTursoActive}
                            <span
                                class="text-[10px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full"
                            >
                                Active
                            </span>
                        {/if}
                    </div>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                        Provide your Turso database credentials to enable
                        real-time, zero-conflict cloud syncing across all
                        computers.
                    </p>
                </div>
            </div>

            <div class="flex flex-col gap-3 pt-2 pl-16">
                <div class="flex flex-col gap-1.5">
                    <label
                        for="turso-url"
                        class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider"
                        >Database URL</label
                    >
                    <input
                        id="turso-url"
                        type="text"
                        bind:value={tursoUrl}
                        placeholder="libsql://your-db-name.turso.io"
                        class="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:border-violet-500 focus:outline-none w-full font-mono text-xs"
                    />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label
                        for="turso-token"
                        class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider"
                        >Auth Token</label
                    >
                    <input
                        id="turso-token"
                        type="password"
                        bind:value={tursoToken}
                        placeholder="ey..."
                        class="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:border-violet-500 focus:outline-none w-full font-mono text-xs"
                    />
                </div>
                <div class="flex items-center justify-between pt-2">
                    {#if isTursoActive}
                        <button
                            onclick={handleClearTurso}
                            class="px-3 py-1.5 border border-red-500/20 text-red-400 hover:bg-red-950/20 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <Trash2 size={14} /> Disconnect Cloud Sync
                        </button>
                    {:else}
                        <div></div>
                    {/if}

                    <button
                        onclick={handleSaveTurso}
                        disabled={!tursoUrl.trim()}
                        class="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save & Restart
                    </button>
                </div>
            </div>
        </div>

        <!-- Database Path -->
        <div class="flex items-start gap-4 pt-2 border-t border-border">
            <div class="p-3 bg-emerald-500/10 text-emerald-500 rounded-lg">
                <Database size={24} />
            </div>
            <div class="space-y-2 flex-1">
                <div class="flex items-center justify-between">
                    <h3 class="font-semibold text-foreground">
                        Local Database Location
                    </h3>
                    <button
                        onclick={handleSelectDatabase}
                        class="text-xs font-bold uppercase text-emerald-500 hover:text-white transition-colors cursor-pointer"
                        >Change</button
                    >
                </div>
                <p
                    class="text-xs text-muted-foreground font-mono bg-background border border-border p-2 rounded-md break-all"
                >
                    {dbPath || workspacePath || "Using default local storage."}
                </p>
                {#if !dbPath}
                    <p class="text-[10px] text-zinc-500">
                        Currently synced alongside Resources.
                    </p>
                {/if}
            </div>
        </div>

        <div class="flex justify-end pt-2">
            {#if workspacePath}
                <button
                    onclick={handleResetWorkspace}
                    class="px-4 py-2 border border-border text-muted-foreground font-semibold rounded-lg text-sm hover:text-red-400 hover:border-red-400/50 hover:bg-red-950/20 transition-colors cursor-pointer"
                >
                    Reset All to Default
                </button>
            {/if}
        </div>
    </div>

    <!-- Settings Backup & Restore Card -->
    <div
        class="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col gap-4"
    >
        <div class="flex items-start gap-4">
            <div class="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                <SettingsIcon size={24} />
            </div>
            <div class="space-y-1 flex-1">
                <h3 class="font-semibold text-foreground">
                    Settings Backup & Restore
                </h3>
                <p class="text-sm text-muted-foreground leading-relaxed">
                    Export your local app preferences (formatting, text styles,
                    window settings) to a JSON file, or import an existing
                    configuration.
                </p>
            </div>
        </div>

        <div class="flex items-center gap-3 pt-2 pl-16">
            <button
                onclick={handleExportSettings}
                class="px-4 py-2 flex items-center gap-2 border border-border text-foreground font-semibold rounded-lg text-sm hover:bg-zinc-800 transition-colors cursor-pointer"
            >
                <Download size={16} /> Export Settings
            </button>
            <button
                onclick={handleImportSettings}
                class="px-4 py-2 flex items-center gap-2 border border-border text-foreground font-semibold rounded-lg text-sm hover:bg-zinc-800 transition-colors cursor-pointer"
            >
                <Upload size={16} /> Import Settings
            </button>
        </div>
    </div>

    <!-- Clear Cache Card -->
    <div
        class="bg-card border border-border rounded-xl p-6 shadow-sm flex items-start justify-between gap-6"
    >
        <div class="space-y-2 flex-1">
            <h3 class="font-semibold text-foreground flex items-center gap-2">
                <Eraser size={18} class="text-muted-foreground" />
                Clear Local Cache
            </h3>
            <p class="text-sm text-muted-foreground leading-relaxed">
                Reset all UI preferences and temporary session data. <strong
                    >Your database and media files will remain completely
                    untouched.</strong
                >
            </p>
        </div>
        <button
            onclick={handleClearCache}
            class="px-4 py-2 font-semibold rounded-lg text-sm transition-all duration-200 cursor-pointer whitespace-nowrap mt-1 {confirmClear
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                : 'border border-border text-foreground hover:bg-zinc-800'}"
        >
            {confirmClear ? "Click again to confirm" : "Clear Cache"}
        </button>
    </div>

    <!-- Info Note -->
    <div
        class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3 text-sm text-blue-200"
    >
        <Info size={20} class="text-blue-400 shrink-0" />
        <p>
            <strong>Note:</strong> When you change your workspace folder or Turso
            configuration, WorshipCuePro will restart to load from the new location.
        </p>
    </div>
</div>
