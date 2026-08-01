<!-- /src/lib/components/ui/ContextMenu.svelte -->
<script lang="ts" module>
    export type ContextMenuItem =
        | {
              type: "action";
              label: string;
              icon?: any; // Receives a Lucide icon component
              danger?: boolean;
              onClick: () => void;
          }
        | {
              type: "divider";
          };
</script>

<script lang="ts">
    let {
        visible = false,
        x = 0,
        y = 0,
        items = [],
        onClose,
    } = $props<{
        visible: boolean;
        x: number;
        y: number;
        items: ContextMenuItem[];
        onClose: () => void;
    }>();

    // Close the menu if the user clicks anywhere else
    function handleWindowClick() {
        if (visible) onClose();
    }

    // Close the menu if the user right-clicks somewhere else
    function handleWindowContext() {
        if (visible) onClose();
    }
</script>

<svelte:window
    onclick={handleWindowClick}
    oncontextmenu={handleWindowContext}
/>

{#if visible}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed z-50 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 text-sm text-zinc-300 backdrop-blur-md overflow-hidden"
        style="top: {y}px; left: {x}px;"
        onclick={(e) => e.stopPropagation()}
        oncontextmenu={(e) => e.stopPropagation()}
    >
        {#each items as item}
            {#if item.type === "divider"}
                <div class="h-px bg-zinc-800 my-1"></div>
            {:else if item.type === "action"}
                <button
                    class="w-full text-left px-4 py-2 hover:bg-zinc-800 transition-colors flex items-center justify-between {item.danger
                        ? 'hover:text-red-400'
                        : 'hover:text-white'}"
                    onclick={(e) => {
                        e.stopPropagation();
                        item.onClick();
                    }}
                >
                    {item.label}
                    {#if item.icon}
                        {@const Icon = item.icon}
                        <Icon
                            size={14}
                            class={item.danger
                                ? "text-red-400 opacity-70"
                                : "opacity-70"}
                        />
                    {/if}
                </button>
            {/if}
        {/each}
    </div>
{/if}
