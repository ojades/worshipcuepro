<!-- /src/lib/components/layout/controlpanel/FormatControls.svelte -->
<script lang="ts">
    import { Type, X } from "@lucide/svelte";
    import TextFormatmenu from "./formatControlMenus/TextFormatmenu.svelte";

    let isOpen = $state(false);
</script>

<div class="relative mt-auto shrink-0 z-50">
    <!-- Slide-up Menu -->
    {#if isOpen}
        <TextFormatmenu />
    {/if}

    <!-- Bottom Action Strip -->
    <div class="flex items-center gap-2 border-t border-border pt-3">
        <button
            onclick={() => (isOpen = !isOpen)}
            class="p-2 rounded-md transition-colors border {isOpen
                ? 'bg-zinc-800 border-zinc-700 text-white'
                : 'bg-zinc-950 border-border text-muted-foreground hover:text-foreground hover:bg-zinc-900'}"
            title="Formatting Options"
        >
            {#if isOpen}
                <X size={16} />
            {:else}
                <Type size={16} />
            {/if}
        </button>

        <!-- Add other global toolbar buttons here in the future -->
    </div>
</div>
