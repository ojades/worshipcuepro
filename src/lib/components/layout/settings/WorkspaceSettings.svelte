<!-- /src/lib/components/layout/settings/WorkspaceSettings.svelte -->
<script lang="ts">
    import { open, save } from "@tauri-apps/plugin-dialog";
    import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
    import { systemState } from "$lib/state/system.svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import { initDB } from "$lib/db";

    import Cloud from "@lucide/svelte/icons/cloud";
    import Info from "@lucide/svelte/icons/info";
    import Eraser from "@lucide/svelte/icons/eraser";
    import Download from "@lucide/svelte/icons/download";
    import Upload from "@lucide/svelte/icons/upload";
    import SettingsIcon from "@lucide/svelte/icons/settings";

    let workspacePath = $derived(settingsState.config.workspacePath);

    // Confirmation state for clearing cache
    let confirmClear = $state(false);
    let clearTimer: ReturnType<typeof setTimeout>;

    async function handleSelectWorkspace() {
        try {
            const selectedDir = await open({
                directory: true,
                multiple: false,
                title: "Select Workspace Folder (e.g., Dropbox or Google Drive)",
            });

            if (selectedDir && typeof selectedDir === "string") {
                settingsState.update({ workspacePath: selectedDir });

                const success = await initDB(selectedDir);

                if (success) {
                    systemState.addAlert({
                        message: "Workspace migrated successfully.",
                        type: "success",
                    });
                }
            }
        } catch (error) {
            systemState.addAlert({
                message: "Failed to set new workspace directory.",
                type: "error",
            });
        }
    }

    async function handleResetWorkspace() {
        settingsState.update({ workspacePath: null });
        await initDB(null);
        systemState.addAlert({
            message: "Reverted to default local storage.",
            type: "success",
        });
    }

    function handleClearCache() {
        if (!confirmClear) {
            confirmClear = true;
            clearTimer = setTimeout(() => {
                confirmClear = false;
            }, 3000); // Reset button after 3 seconds
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
            Select a shared folder on your computer to store your database and
            media files in one place. Use a folder synced to <strong
                class="text-foreground">Dropbox</strong
            >
            or <strong class="text-foreground">Google Drive</strong>, to access
            you media and lyrics library across multiple computers.
        </p>
    </div>

    <!-- Active Workspace Card -->
    <div
        class="bg-card border border-border rounded-xl p-6 space-y-5 shadow-sm"
    >
        <div class="flex items-start gap-4">
            <div class="p-3 bg-neon-violet/10 text-neon-violet rounded-lg">
                <Cloud size={24} />
            </div>
            <div class="space-y-1 flex-1">
                <h3 class="font-semibold text-foreground">
                    Active Workspace Directory
                </h3>
                <p
                    class="text-xs text-muted-foreground font-mono bg-background border border-border p-2 rounded-md break-all"
                >
                    {workspacePath ||
                        "No workspace selected. Using default local storage."}
                </p>
            </div>
        </div>

        <div class="flex items-center gap-3 pt-2">
            <button
                onclick={handleSelectWorkspace}
                class="px-4 py-2 bg-foreground text-background font-semibold rounded-lg text-sm hover:bg-zinc-200 transition-colors cursor-pointer"
            >
                Select Workspace Folder
            </button>
            {#if workspacePath}
                <button
                    onclick={handleResetWorkspace}
                    class="px-4 py-2 border border-border text-muted-foreground font-semibold rounded-lg text-sm hover:text-red-400 hover:border-red-400/50 transition-colors cursor-pointer"
                >
                    Reset to Default
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
            class="px-4 py-2 font-semibold rounded-lg text-sm transition-all duration-200 cursor-pointer whitespace-nowrap mt-1
            {confirmClear
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
            <strong>Note:</strong> When you change your workspace folder, WorshipCuePro
            will restart to load the database from the new location. Ensure your cloud
            sync application is running and fully updated before opening the app on
            a second computer.
        </p>
    </div>
</div>
