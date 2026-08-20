<!-- /src/lib/components/layout/AutoUpdater.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import { check } from "@tauri-apps/plugin-updater";
    import { relaunch } from "@tauri-apps/plugin-process";
    import { Download, CheckCircle2, RefreshCw } from "@lucide/svelte";

    let updateAvailable = $state<any>(null);
    let isDownloading = $state(false);
    let downloadProgress = $state(0);
    let isFinished = $state(false);

    onMount(async () => {
        try {
            const update = await check();
            if (update) {
                updateAvailable = update;
            }
        } catch (error) {
            console.error("Failed to check for updates:", error);
        }
    });

    async function handleInstall() {
        if (!updateAvailable) return;

        isDownloading = true;
        let downloaded = 0;
        let contentLength = 0;

        try {
            await updateAvailable.downloadAndInstall((event: any) => {
                switch (event.event) {
                    case "Started":
                        contentLength = event.data.contentLength;
                        break;
                    case "Progress":
                        downloaded += event.data.chunkLength;
                        if (contentLength > 0) {
                            downloadProgress = Math.round(
                                (downloaded / contentLength) * 100,
                            );
                        }
                        break;
                    case "Finished":
                        isFinished = true;
                        break;
                }
            });

            await relaunch();
        } catch (error) {
            console.error("Update failed:", error);
            isDownloading = false;
            alert("Update failed to install. " + error);
        }
    }
</script>

{#if updateAvailable}
    <div
        class="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300"
    >
        <div
            class="bg-zinc-950 border border-neon-violet/50 rounded-xl shadow-2xl p-4 w-80"
        >
            <div class="flex items-start gap-3">
                <div class="p-2 bg-neon-violet/20 text-neon-violet rounded-lg">
                    <Download size={20} />
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-white text-sm">
                        Update Available
                    </h3>
                    <p class="text-xs text-zinc-400 mt-1">
                        Version {updateAvailable.version} is ready to install.
                    </p>

                    {#if updateAvailable.body}
                        <div
                            class="mt-2 text-xs text-zinc-300 bg-zinc-900 p-2 rounded-md max-h-20 overflow-y-auto custom-scrollbar"
                        >
                            {updateAvailable.body}
                        </div>
                    {/if}

                    <div class="mt-4">
                        {#if isDownloading && !isFinished}
                            <div class="space-y-2">
                                <div
                                    class="flex justify-between text-[10px] text-zinc-400 font-bold uppercase"
                                >
                                    <span>Downloading...</span>
                                    <span>{downloadProgress}%</span>
                                </div>
                                <div
                                    class="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden"
                                >
                                    <div
                                        class="bg-neon-violet h-full transition-all duration-200"
                                        style="width: {downloadProgress}%"
                                    ></div>
                                </div>
                            </div>
                        {:else if isFinished}
                            <div
                                class="flex items-center gap-2 text-sm text-green-400 font-bold"
                            >
                                <CheckCircle2 size={16} /> Restarting App...
                            </div>
                        {:else}
                            <div class="flex gap-2">
                                <button
                                    onclick={() => (updateAvailable = null)}
                                    class="px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                                >
                                    Dismiss
                                </button>
                                <button
                                    onclick={handleInstall}
                                    class="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold bg-neon-violet text-white rounded-lg hover:bg-neon-violet-dark transition-colors"
                                >
                                    <RefreshCw size={14} /> Install & Restart
                                </button>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
