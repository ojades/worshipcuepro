<!-- src/lib/components/ui/Button.svelte -->
<script lang="ts">
    import type { Snippet } from "svelte";
    // Assuming your variants object is defined here...
    const variants = {
        primary:
            "bg-neon-violet hover:bg-neon-violet-dark text-white border-transparent shadow-md shadow-neon-violet/20",
        secondary:
            "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700",
        danger: "bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20 hover:border-red-500/40",
        ghost: "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border-transparent",
    };

    let {
        type = "button",
        onclick,
        variant = "primary",
        class: className = "",
        Icon,
        children,
        ...rest // 1. Capture all remaining props
    } = $props<{
        type?: "button" | "submit" | "reset";
        onclick?: (event: MouseEvent) => void;
        variant?: keyof typeof variants;
        class?: string;
        Icon?: any;
        children: Snippet;
        [key: string]: any; // Allow arbitrary standard HTML attributes
    }>();
</script>

<button
    {type}
    {onclick}
    class="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-full border transition-all active:scale-95 {variants[
        variant
    ]} {className}"
    {...rest}
>
    {#if Icon}
        <Icon size={16} />
    {/if}
    {@render children()}
</button>
