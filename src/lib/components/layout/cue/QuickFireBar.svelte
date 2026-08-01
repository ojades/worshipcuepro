<!-- src/lib/components/layout/QuickFireBar.svelte -->
<script lang="ts">
    import { presentation } from "$lib/state/presentation.svelte";
</script>

<div class="flex items-center justify-between">
    <!-- Next / Prev Slide Navigation -->
    <div class="flex gap-2">
        <button
            class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
            onclick={() => presentation.prevSlide()}
            disabled={!presentation.activeCue}
        >
            &larr; Prev
        </button>
        <button
            class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
            onclick={() => presentation.nextSlide()}
            disabled={!presentation.activeCue}
        >
            Next &rarr;
        </button>
    </div>

    <!-- Output Modifiers -->
    <div class="flex gap-3">
        <button
            class="px-6 py-2 rounded-md font-semibold transition-colors
                {presentation.isTextCleared
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
            onclick={() => presentation.toggleClearText()}
        >
            Clear Text
        </button>

        <button
            class="px-6 py-2 rounded-md font-semibold transition-colors
                {presentation.isBlackout
                ? 'bg-red-600 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
            onclick={() => presentation.toggleBlackout()}
        >
            Blackout
        </button>
    </div>
</div>
