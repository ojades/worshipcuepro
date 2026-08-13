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

        // --- Prevent Backspace & History Navigation from ruining the show ---
        if (!isInput) {
            if (e.key === "Backspace") {
                e.preventDefault();
            }
            // Block Cmd+Left, Cmd+Right, Alt+Left, Alt+Right to prevent browser history back/forward
            if (
                (e.metaKey || e.altKey) &&
                (e.key === "ArrowLeft" || e.key === "ArrowRight")
            ) {
                e.preventDefault();
            }
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

        // --- Sidebar Navigation ---
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

        // --- NEW: Jump to First/Last slide or section ---
        else if (
            checkShortcut(e, SHORTCUTS.FIRST_SECTION) ||
            checkShortcut(e, SHORTCUTS.LAST_SECTION) ||
            checkShortcut(e, SHORTCUTS.FIRST_SLIDE_SECTION) ||
            checkShortcut(e, SHORTCUTS.LAST_SLIDE_SECTION)
        ) {
            e.preventDefault();
            const cue: any = presentation.activeCue;

            if (cue?.sections?.length) {
                let targetSecIndex = 0;
                let targetSlideIndex = 0;

                // Find index of currently active section
                let currentSecIndex = cue.sections.findIndex((s: any) =>
                    s.slides.some(
                        (sl: any) => sl.id === presentation.activeSlideId,
                    ),
                );
                if (currentSecIndex === -1) currentSecIndex = 0;

                if (checkShortcut(e, SHORTCUTS.FIRST_SECTION)) {
                    targetSecIndex = 0;
                    targetSlideIndex = 0;
                } else if (checkShortcut(e, SHORTCUTS.LAST_SECTION)) {
                    targetSecIndex = cue.sections.length - 1;
                    targetSlideIndex = 0; // Jump to the beginning of the last section
                } else if (checkShortcut(e, SHORTCUTS.FIRST_SLIDE_SECTION)) {
                    targetSecIndex = currentSecIndex;
                    targetSlideIndex = 0;
                } else if (checkShortcut(e, SHORTCUTS.LAST_SLIDE_SECTION)) {
                    targetSecIndex = currentSecIndex;
                    targetSlideIndex =
                        cue.sections[currentSecIndex].slides.length - 1;
                }

                const sec = cue.sections[targetSecIndex];
                if (sec?.slides?.length) {
                    presentation.fire(
                        cue,
                        sec.id,
                        sec.slides[targetSlideIndex].id,
                    );
                }
            }
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
