<script lang="ts">
    import { page } from "$app/stores";
    import { libraryState } from "$lib/state/library.svelte";
    import { MonitorPlay } from "@lucide/svelte";
    import BookOpen from "@lucide/svelte/icons/book-open";
    import Film from "@lucide/svelte/icons/film";
    import Library from "@lucide/svelte/icons/library";
    import Music from "@lucide/svelte/icons/music";
    import Settings from "@lucide/svelte/icons/settings";
    import { SHORTCUTS, formatShortcut } from "$lib/utils/shortcuts";

    // Navigation schema map
    const navItems = [
        {
            id: "" as const,
            label: "Cues",
            icon: Library,
            shortcut: SHORTCUTS.NAV_CUES,
        },
        {
            id: "lyrics" as const,
            label: "Lyrics",
            icon: Music,
            shortcut: SHORTCUTS.NAV_LYRICS,
        },
        {
            id: "bibles" as const,
            label: "Bibles",
            icon: BookOpen,
            shortcut: SHORTCUTS.NAV_BIBLES,
        },
        {
            id: "media" as const,
            label: "Media",
            icon: Film,
            shortcut: SHORTCUTS.NAV_MEDIA,
        },
        {
            id: "shoots" as const,
            label: "Shoots",
            icon: MonitorPlay,
            shortcut: SHORTCUTS.NAV_SHOOTS,
        },
        {
            id: "settings" as const,
            label: "Settings",
            icon: Settings,
            shortcut: SHORTCUTS.NAV_SETTINGS,
        },
    ];
</script>

<aside
    class="w-16 h-full bg-sidebar border-r border-border flex flex-col items-center py-6 gap-6 z-20"
>
    <!-- Micro Logo Placeholder -->
    <div
        class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs tracking-tighter mb-4 shadow-[0_0_15px_rgba(147,51,234,0.15)]"
    >
        <img
            src="/worshipcuepro-logo-sq.png"
            alt="WCP Logo"
            class="w-full h-full object-contain"
        />
    </div>

    <nav class="flex-1 flex flex-col gap-3 w-full px-2">
        {#each navItems as item}
            {@const isActive =
                item.id === ""
                    ? $page.url.pathname === "/operator" ||
                      $page.url.pathname === "/operator/"
                    : $page.url.pathname.startsWith(`/operator/${item.id}`)}

            {@const href = item.id ? `/operator/${item.id}` : "/operator"}

            <!-- Generate tooltip text like "Bibles (⌘3)" -->
            {@const tooltip = `${item.label} (${formatShortcut(item.shortcut)})`}

            <a {href}>
                <button
                    class="w-full py-2 aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 relative group hover:text-neon-violet/80 hover:bg-muted/30 cursor-pointer
                    {isActive
                        ? 'text-neon-violet bg-neon-violet/5 border-l-4 border-neon-violet shadow-[0_0_10px_rgba(147,51,234,0.1)]'
                        : 'text-zinc-400'}"
                    title={tooltip}
                    aria-label={tooltip}
                >
                    <item.icon size={30} strokeWidth={isActive ? 2.2 : 1.8} />
                    <span
                        class="text-[10px] mt-1 font-medium tracking-wide opacity-80"
                        >{item.label}</span
                    >
                </button>
            </a>
        {/each}
    </nav>
</aside>
