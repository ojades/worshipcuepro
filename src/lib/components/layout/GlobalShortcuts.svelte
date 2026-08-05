<!-- src/lib/components/layout/GlobalShortcuts.svelte -->
<script lang="ts">
    import { goto } from "$app/navigation";
    import { presentation } from "$lib/state/presentation.svelte";
    import { SHORTCUTS, checkShortcut } from "$lib/utils/shortcuts";

    function handleGlobalKeydown(e: KeyboardEvent) {
        const target = e.target as HTMLElement;

        const isInput =
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable;

        // --- NEW: Prevent Backspace from navigating history ---
        if (e.key === "Backspace" && !isInput) {
            e.preventDefault();
        }

        if (checkShortcut(e, SHORTCUTS.SAVE_EDIT)) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("shortcut-save-edit"));
            return;
        }
        if (checkShortcut(e, SHORTCUTS.ESCAPE)) {
            window.dispatchEvent(new CustomEvent("shortcut-escape"));
            return;
        }
        if (checkShortcut(e, SHORTCUTS.QUICK_FINDER)) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("shortcut-quick-finder"));
            return;
        }

        // --- NEW: Sidebar Navigation ---
        if (checkShortcut(e, SHORTCUTS.NAV_CUES)) {
            e.preventDefault();
            goto("/operator");
            return;
        }
        if (checkShortcut(e, SHORTCUTS.NAV_LYRICS)) {
            e.preventDefault();
            goto("/operator/lyrics");
            return;
        }
        if (checkShortcut(e, SHORTCUTS.NAV_BIBLES)) {
            e.preventDefault();
            goto("/operator/bibles");
            return;
        }
        if (checkShortcut(e, SHORTCUTS.NAV_MEDIA)) {
            e.preventDefault();
            goto("/operator/media");
            return;
        }
        if (checkShortcut(e, SHORTCUTS.NAV_SHOOTS)) {
            e.preventDefault();
            goto("/operator/shoots");
            return;
        }
        if (checkShortcut(e, SHORTCUTS.NAV_SETTINGS)) {
            e.preventDefault();
            goto("/operator/settings");
            return;
        }

        if (isInput) return;

        if (checkShortcut(e, SHORTCUTS.BLACKOUT)) {
            e.preventDefault();
            presentation.toggleBlackout();
        } else if (checkShortcut(e, SHORTCUTS.CLEAR_TEXT)) {
            e.preventDefault();
            presentation.toggleClearText();
        } else if (checkShortcut(e, SHORTCUTS.CLEAR_CUE)) {
            e.preventDefault();
            presentation.clearActiveCue();
        } else if (checkShortcut(e, SHORTCUTS.DISPLAY_MENU)) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("toggle-display-menu"));
        }

        if (!presentation.activeCue) {
            return;
        } else if (
            checkShortcut(e, SHORTCUTS.NEXT_SLIDE) ||
            checkShortcut(e, SHORTCUTS.NEXT_SLIDE_SPACE)
        ) {
            e.preventDefault();
            presentation.nextSlide();
        } else if (checkShortcut(e, SHORTCUTS.PREV_SLIDE)) {
            e.preventDefault();
            presentation.prevSlide();
        } else if (checkShortcut(e, SHORTCUTS.NEXT_SECTION)) {
            e.preventDefault();
            presentation.nextSection();
        } else if (checkShortcut(e, SHORTCUTS.PREV_SECTION)) {
            e.preventDefault();
            presentation.prevSection();
        }

        // 5. Operator View Custom Events
        else if (checkShortcut(e, SHORTCUTS.QUICK_EDIT)) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("shortcut-quick-edit"));
        } else if (
            checkShortcut(e, SHORTCUTS.VERSE_JUMP_SLASH) ||
            checkShortcut(e, SHORTCUTS.VERSE_JUMP_F)
        ) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("shortcut-verse-jump"));
        }
    }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />
