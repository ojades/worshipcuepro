<!-- src/lib/components/layout/settings/RemoteDisplay.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import { getNetworkUrls, type NetworkUrls } from "$lib/utils/helper";
    import { RefreshCw } from "@lucide/svelte";

    let urls = $state<NetworkUrls | null>(null);
    let copiedObs = $state(false);
    let copiedStage = $state(false);
    let isRefreshing = $state(false);

    onMount(async () => {
        urls = await getNetworkUrls();
    });

    // --- NEW: Refresh Function ---
    async function refreshUrls() {
        isRefreshing = true;
        urls = await getNetworkUrls();

        setTimeout(() => {
            isRefreshing = false;
        }, 500);
    }

    async function copyToClipboard(text: string, target: "obs" | "stage") {
        try {
            await navigator.clipboard.writeText(text);

            if (target === "obs") {
                copiedObs = true;
                setTimeout(() => (copiedObs = false), 2000);
            } else {
                copiedStage = true;
                setTimeout(() => (copiedStage = false), 2000);
            }
        } catch (error) {
            console.error("Failed to copy to clipboard:", error);
        }
    }
</script>

<div class="max-w-2xl animate-in fade-in duration-300">
    <!-- Flex container to align title and refresh button -->
    <div class="flex items-center justify-between mb-2">
        <h1 class="text-2xl font-bold text-foreground">Remote Display</h1>

        <button
            onclick={refreshUrls}
            disabled={isRefreshing}
            class="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-muted/50 disabled:opacity-50"
        >
            <RefreshCw size={14} class={isRefreshing ? "animate-spin" : ""} />
            Refresh IPs
        </button>
    </div>

    <p class="text-sm text-muted-foreground mb-6">
        Connect external devices on your local network to WorshipCuePro.
    </p>

    {#if urls}
        <div class="space-y-4">
            <!-- OBS Network URL -->
            <div
                class="flex flex-col gap-3 p-5 border border-border rounded-xl bg-card text-card-foreground shadow-sm"
            >
                <div>
                    <h3 class="font-semibold text-foreground">
                        OBS Browser Source
                    </h3>
                    <p class="text-sm text-muted-foreground">
                        Add this URL as a Browser Source in OBS for transparent
                        lower-thirds.
                    </p>
                </div>

                <div class="flex items-center gap-2 mt-1">
                    <code
                        class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-muted-foreground font-mono select-all overflow-x-auto whitespace-nowrap"
                    >
                        {urls.obsUrl}
                    </code>
                    <button
                        onclick={() => copyToClipboard(urls!.obsUrl, "obs")}
                        class="flex items-center justify-center min-w-[100px] px-3 py-2 text-sm font-medium transition-colors border border-border rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        {#if copiedObs}
                            <span
                                class="text-green-500 flex items-center gap-1.5"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    ><polyline points="20 6 9 17 4 12" /></svg
                                >
                                Copied
                            </span>
                        {:else}
                            <span class="flex items-center gap-1.5">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    ><rect
                                        width="14"
                                        height="14"
                                        x="8"
                                        y="8"
                                        rx="2"
                                        ry="2"
                                    /><path
                                        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                                    /></svg
                                >
                                Copy URL
                            </span>
                        {/if}
                    </button>
                </div>
            </div>

            <!-- Stage Network URL -->
            <div
                class="flex flex-col gap-3 p-5 border border-border rounded-xl bg-card text-card-foreground shadow-sm"
            >
                <div>
                    <h3 class="font-semibold text-foreground">
                        Remote Stage Display
                    </h3>
                    <p class="text-sm text-muted-foreground">
                        Open this URL on an iPad or secondary PC browser
                        connected to the same Wi-Fi.
                    </p>
                </div>

                <div class="flex items-center gap-2 mt-1">
                    <code
                        class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-muted-foreground font-mono select-all overflow-x-auto whitespace-nowrap"
                    >
                        {urls.stageUrl}
                    </code>
                    <button
                        onclick={() => copyToClipboard(urls!.stageUrl, "stage")}
                        class="flex items-center justify-center min-w-[100px] px-3 py-2 text-sm font-medium transition-colors border border-border rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        {#if copiedStage}
                            <span
                                class="text-green-500 flex items-center gap-1.5"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    ><polyline points="20 6 9 17 4 12" /></svg
                                >
                                Copied
                            </span>
                        {:else}
                            <span class="flex items-center gap-1.5">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    ><rect
                                        width="14"
                                        height="14"
                                        x="8"
                                        y="8"
                                        rx="2"
                                        ry="2"
                                    /><path
                                        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                                    /></svg
                                >
                                Copy URL
                            </span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {:else}
        <div
            class="p-8 border border-dashed border-border rounded-xl text-center text-muted-foreground flex flex-col items-center justify-center gap-3"
        >
            <div
                class="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"
            ></div>
            Loading network URLs...
        </div>
    {/if}
</div>
