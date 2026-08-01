<!-- src/lib/components/layout/Alert.svelte -->
<script lang="ts">
    import { systemState } from "$lib/state/system.svelte";
    import { fly, fade } from "svelte/transition";
    import { flip } from "svelte/animate";

    // Icons
    import Info from "@lucide/svelte/icons/info";
    import CheckCircle from "@lucide/svelte/icons/check-circle";
    import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
    import XCircle from "@lucide/svelte/icons/x-circle";
    import X from "@lucide/svelte/icons/x";

    const iconMap = {
        info: Info,
        success: CheckCircle,
        warning: AlertTriangle,
        error: XCircle,
    };

    const colorMap = {
        info: "bg-blue-500/10 border-blue-500/20 text-blue-400",
        success: "bg-green-500/10 border-green-500/20 text-green-400",
        warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
        error: "bg-red-500/10 border-red-500/20 text-red-400",
    };
</script>

<div
    class="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm"
>
    {#each systemState.alerts as alert (alert.id)}
        {@const Icon = iconMap[alert.type]}
        <div
            animate:flip={{ duration: 300 }}
            in:fly={{ x: 50, duration: 300 }}
            out:fade={{ duration: 200 }}
            class="pointer-events-auto flex items-start gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950 shadow-lg backdrop-blur-md"
        >
            <!-- Icon based on type -->
            <div
                class="shrink-0 mt-0.5 p-1 rounded-full {colorMap[
                    alert.type
                ]} border-transparent"
            >
                <Icon size={18} />
            </div>

            <!-- Message -->
            <div class="flex-1 text-sm text-zinc-200 mt-1 leading-snug">
                {alert.message}
            </div>

            <!-- Close Button -->
            <button
                onclick={() => systemState.removeAlert(alert.id)}
                class="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-1"
                aria-label="Close alert"
            >
                <X size={16} />
            </button>
        </div>
    {/each}
</div>
