<!-- src/lib/components/ui/RemoteQr.svelte -->
<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import QRCode from "qrcode";
    import { Smartphone, Wifi } from "@lucide/svelte";

    let localIp = $state("Detecting...");
    let qrCanvas = $state<HTMLCanvasElement | null>(null);
    let remoteUrl = $derived(
        localIp !== "Detecting..." && localIp !== "Offline"
            ? `http://${localIp}:8080/remote`
            : "",
    );

    onMount(async () => {
        try {
            // Fetch the dynamic DHCP IP using your existing Rust command
            localIp = await invoke("get_local_ip");

            if (qrCanvas && remoteUrl) {
                await QRCode.toCanvas(qrCanvas, remoteUrl, {
                    width: 160,
                    margin: 2,
                    color: {
                        dark: "#8b5cf6", // Neon Violet
                        light: "#ffffff",
                    },
                });
            }
        } catch (e) {
            localIp = "Offline";
        }
    });
</script>

<div
    class="flex flex-col md:flex-row gap-6 p-5 border border-border rounded-xl bg-card text-card-foreground shadow-sm"
>
    <!-- QR Code Graphic -->
    <div
        class="bg-white p-2 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.15)] shrink-0 flex items-center justify-center w-[176px] h-[176px] mx-auto md:mx-0"
    >
        <canvas bind:this={qrCanvas} class={!remoteUrl ? "hidden" : ""}
        ></canvas>
        {#if !remoteUrl}
            <div class="flex items-center justify-center text-zinc-400">
                <Wifi size={32} class="animate-pulse" />
            </div>
        {/if}
    </div>

    <!-- Instructions & Link -->
    <div
        class="flex flex-col justify-center flex-1 w-full text-center md:text-left"
    >
        <div
            class="flex items-center justify-center md:justify-start gap-3 mb-2"
        >
            <div
                class="w-8 h-8 bg-neon-violet/20 rounded-full flex items-center justify-center text-neon-violet shrink-0"
            >
                <Smartphone size={16} />
            </div>
            <h3 class="font-semibold text-foreground text-lg">Mobile Remote</h3>
        </div>

        <p class="text-sm text-muted-foreground mb-4">
            Scan this QR code with your phone or tablet camera to instantly open
            the remote control. No app installation required.
        </p>

        <div
            class="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 w-full mt-auto"
        >
            <p class="text-[10px] uppercase font-bold text-zinc-500 mb-1">
                Manual Browser Link
            </p>
            <code
                class="font-mono text-neon-cyan text-sm font-bold select-all overflow-x-auto whitespace-nowrap block"
            >
                {remoteUrl || "Waiting for Network..."}
            </code>
        </div>
    </div>
</div>
