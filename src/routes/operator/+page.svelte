<!-- src/routes/operator/+page.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte"; // <-- Add onMount here
    import QuickFinder from "$lib/components/layout/cue/QuickFinder.svelte";
    import SlideGrid from "$lib/components/layout/cue/SlideGrid.svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { Settings2, Edit2, Hash } from "@lucide/svelte";
    import Button from "$lib/components/ui/Button.svelte";
    import { SHORTCUTS, formatShortcut } from "$lib/utils/shortcuts"; // Optional: to populate tooltips natively

    let isSongCue = $derived(
        presentation.activeCue &&
            (presentation.activeCue as any).raw_lyrics !== undefined,
    );
    let isBibleCue = $derived(
        presentation.activeCue &&
            (presentation.activeCue as any).type === "bible",
    );
    let canFormatLayout = $derived(isSongCue || isBibleCue);

    let isQuickEditing = $state(false);
    let editLyrics = $state("");

    let isVerseJumping = $state(false);
    let jumpQuery = $state("");
    let jumpInputRef = $state<HTMLInputElement | null>(null);

    let currentVerseTracker = $derived.by(() => {
        if (
            !isBibleCue ||
            !presentation.activeCue ||
            !presentation.activeSlideId
        )
            return null;
        const sections = presentation.activeCue.sections || [];
        const totalVerses = sections.length;
        const currentSecIndex = sections.findIndex((sec: any) =>
            sec.slides.some((s: any) => s.id === presentation.activeSlideId),
        );
        if (currentSecIndex === -1) return null;
        return `Verse ${currentSecIndex + 1} of ${totalVerses}`;
    });

    function startQuickEdit() {
        if (!presentation.activeCue) return;
        editLyrics = (presentation.activeCue as any).raw_lyrics || "";
        isQuickEditing = true;
    }

    async function saveQuickEdit() {
        if (!isQuickEditing) return;
        await presentation.updateSongLyrics(editLyrics);
        isQuickEditing = false;
    }

    function cancelQuickEdit() {
        isQuickEditing = false;
    }

    function executeVerseJump() {
        if (!isBibleCue || !jumpQuery.trim() || !presentation.activeCue) return;
        const targetVerseNum = jumpQuery.trim();

        const targetSection = presentation.activeCue.sections.find((s: any) => {
            const versePart = s.title.split(":").pop();
            return versePart === targetVerseNum;
        });

        if (targetSection && targetSection.slides.length > 0) {
            presentation.fire(
                presentation.activeCue,
                targetSection.id,
                targetSection.slides[0].id,
            );
        }

        isVerseJumping = false;
        jumpQuery = "";
    }

    // --- NEW EVENT LISTENER MOUNT ---
    onMount(() => {
        const handleEscape = () => {
            if (isQuickEditing) cancelQuickEdit();
            else if (isVerseJumping) {
                isVerseJumping = false;
                jumpQuery = "";
            }
        };

        const handleQuickEdit = () => {
            if (isSongCue) {
                if (isQuickEditing) cancelQuickEdit();
                else startQuickEdit();
            }
        };

        const handleSaveEdit = () => {
            if (isQuickEditing) saveQuickEdit();
        };

        const handleVerseJump = () => {
            if (isBibleCue) {
                isVerseJumping = true;
                jumpQuery = "";
                setTimeout(() => jumpInputRef?.focus(), 50);
            }
        };

        window.addEventListener("shortcut-escape", handleEscape);
        window.addEventListener("shortcut-quick-edit", handleQuickEdit);
        window.addEventListener("shortcut-save-edit", handleSaveEdit);
        window.addEventListener("shortcut-verse-jump", handleVerseJump);

        return () => {
            window.removeEventListener("shortcut-escape", handleEscape);
            window.removeEventListener("shortcut-quick-edit", handleQuickEdit);
            window.removeEventListener("shortcut-save-edit", handleSaveEdit);
            window.removeEventListener("shortcut-verse-jump", handleVerseJump);
        };
    });
</script>

<svelte:head>
    <title>Cue - WorshipCuePro</title>
</svelte:head>

<div class="flex flex-col h-full overflow-hidden bg-background">
    <!-- Header Area -->
    <div
        class="p-6 pb-4 shrink-0 border-b border-border flex items-center justify-between gap-4"
    >
        {#if presentation.activeCue}
            <div class="flex items-center gap-4 min-w-0">
                <h1
                    class="text-2xl font-bold text-foreground tracking-tight truncate"
                >
                    {presentation.activeCue.title}
                </h1>

                <!-- Bible Verse Tracker / Jumper Trigger Badge -->
                {#if isBibleCue}
                    {#if isVerseJumping}
                        <div
                            class="flex items-center gap-2 bg-zinc-900/90 border-2 border-neon-violet px-3 py-1.5 rounded-xl animate-in fade-in shadow-lg shadow-neon-violet/10"
                        >
                            <Hash size={18} class="text-neon-violet" />
                            <input
                                bind:this={jumpInputRef}
                                bind:value={jumpQuery}
                                type="text"
                                placeholder="Verse"
                                class="w-16 bg-transparent text-base text-foreground font-bold outline-none font-mono placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground"
                                onkeydown={(e) => {
                                    if (e.key === "Enter") executeVerseJump();
                                }}
                            />
                            <span
                                class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
                                >[Enter]</span
                            >
                        </div>
                    {:else}
                        <button
                            onclick={() => {
                                isVerseJumping = true;
                                setTimeout(() => jumpInputRef?.focus(), 50);
                            }}
                            class="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/50 rounded-xl text-sm md:text-base font-bold text-zinc-300 transition-all cursor-pointer group shadow-sm"
                            title="Press '/' or 'F' to jump to verse"
                        >
                            <Hash
                                size={16}
                                class="text-zinc-500 group-hover:text-neon-violet transition-colors"
                            />
                            <span
                                class="group-hover:text-white transition-colors"
                                >{currentVerseTracker || "Jump Verse"}</span
                            >
                        </button>
                    {/if}
                {/if}
            </div>

            <!-- Live Formatting Controls (Top Right) -->
            {#if canFormatLayout}
                <div class="flex items-center gap-3">
                    <div
                        class="flex items-center gap-2 bg-card/50 border border-zinc-800 rounded-lg px-2 py-1 shadow-sm"
                    >
                        <Settings2 size={16} class="text-muted-foreground" />
                        <span
                            class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1"
                        >
                            Lines
                        </span>
                        <select
                            class="bg-background border border-border text-xs rounded-md px-2 py-1 outline-none focus:border-neon-violet transition-colors cursor-pointer"
                            value={(presentation.activeCue as any)
                                .lines_per_slide || 0}
                            onchange={(e) =>
                                presentation.updateCueLayout(
                                    Number(e.currentTarget.value),
                                )}
                            disabled={isQuickEditing}
                            title="Format lines per slide"
                        >
                            <option value={0}>Auto</option>
                            <option value={2}>2 Lines</option>
                            <option value={4}>4 Lines</option>
                            <option value={6}>6 Lines</option>
                        </select>
                    </div>

                    {#if isSongCue && !isQuickEditing}
                        <Button
                            icon={Edit2}
                            onclick={startQuickEdit}
                            title="({formatShortcut(SHORTCUTS.QUICK_EDIT)})"
                            class="bg-neon-violet hover:bg-neon-violet/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-neon-violet/20"
                        >
                            Quick Edit
                        </Button>
                    {/if}
                </div>
            {/if}
        {:else}
            <h1
                class="text-2xl font-bold text-muted-foreground/50 tracking-tight"
            >
                No Active Cue
            </h1>
        {/if}
    </div>

    <!-- Active Cue Slides Grid (Top 2/3) -->
    <div class="flex-1 overflow-y-auto p-6 min-h-0 custom-scrollbar">
        <SlideGrid
            bind:isQuickEditing
            bind:editLyrics
            onSaveEdit={saveQuickEdit}
            onCancelEdit={cancelQuickEdit}
        />
    </div>

    <!-- Quick Finder (Bottom 1/3) -->
    <div
        class="h-1/3 min-h-70 shrink-0 border-t border-border bg-card/30 p-6 flex flex-col gap-4"
    >
        <QuickFinder />
    </div>
</div>
