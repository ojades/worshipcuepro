<!-- src/lib/components/layout/cue/SlideGrid.svelte -->
<script lang="ts">
    import { presentation } from "$lib/state/presentation.svelte";
    import { X, Save, Image as ImageIcon, Video } from "@lucide/svelte";
    import Button from "$lib/components/ui/Button.svelte";
    import { formatShortcut, SHORTCUTS } from "$lib/utils/shortcuts";

    let {
        isQuickEditing = $bindable(false),
        editLyrics = $bindable(""),
        onSaveEdit,
        onCancelEdit,
    } = $props<{
        isQuickEditing: boolean;
        editLyrics: string;
        onSaveEdit: () => void;
        onCancelEdit: () => void;
    }>();

    let scrollContainer: HTMLDivElement | null = $state(null);

    // Watch active slide ID and smoothly scroll the active section and slide into view
    $effect(() => {
        if (
            presentation.activeSlideId &&
            presentation.activeCue &&
            scrollContainer
        ) {
            setTimeout(() => {
                const activeSection = presentation.activeCue?.sections.find(
                    (section: any) =>
                        section.slides.some(
                            (s: any) => s.id === presentation.activeSlideId,
                        ),
                );

                if (activeSection) {
                    // --- 1. Vertical Auto-Scroll (Section Level) ---
                    const activeElement = document.getElementById(
                        `section-for-${activeSection.id}`,
                    );

                    if (activeElement && scrollContainer) {
                        const containerTop =
                            scrollContainer.getBoundingClientRect().top;
                        const elementTop =
                            activeElement.getBoundingClientRect().top;
                        const offset = elementTop - containerTop;
                        const isVisible =
                            offset >= 0 &&
                            offset <= scrollContainer.clientHeight - 100;

                        if (!isVisible) {
                            scrollContainer.scrollTo({
                                top: scrollContainer.scrollTop + offset - 40,
                                behavior: "smooth",
                            });
                        }
                    }

                    // --- 2. Horizontal Auto-Scroll (Slide Level) ---
                    const horizontalContainer = document.getElementById(
                        `scroll-x-for-${activeSection.id}`,
                    );
                    const activeSlideElement = document.getElementById(
                        `slide-${presentation.activeSlideId}`,
                    );

                    if (horizontalContainer && activeSlideElement) {
                        const containerLeft =
                            horizontalContainer.getBoundingClientRect().left;
                        const elementLeft =
                            activeSlideElement.getBoundingClientRect().left;
                        const offsetLeft = elementLeft - containerLeft;

                        const isVisibleX =
                            offsetLeft >= 0 &&
                            offsetLeft + activeSlideElement.offsetWidth <=
                                horizontalContainer.clientWidth;

                        if (!isVisibleX) {
                            horizontalContainer.scrollTo({
                                left:
                                    horizontalContainer.scrollLeft +
                                    offsetLeft -
                                    40, // 40px buffer
                                behavior: "smooth",
                            });
                        }
                    }
                }
            }, 10);
        }
    });
</script>

{#if presentation.activeCue}
    <div class="flex flex-col h-full">
        {#if isQuickEditing}
            <!-- Quick Edit Pane -->
            <div
                class="flex-1 flex flex-col gap-3 min-h-[300px] animate-in fade-in slide-in-from-top-2 duration-200"
            >
                <div class="flex items-center justify-between">
                    <p
                        class="text-xs font-bold text-yellow-500 uppercase tracking-wider"
                    >
                        Live Edit Mode
                    </p>
                    <div class="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            icon={X}
                            onclick={onCancelEdit}
                            title="({formatShortcut(SHORTCUTS.ESCAPE)}}"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            icon={Save}
                            onclick={onSaveEdit}
                            title="({formatShortcut(SHORTCUTS.SAVE_EDIT)}}"
                        >
                            Save & Update
                        </Button>
                    </div>
                </div>
                <textarea
                    bind:value={editLyrics}
                    class="flex-1 w-full bg-background border-2 border-yellow-500/50 text-foreground text-sm font-mono px-4 py-4 rounded-xl focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none resize-none shadow-inner"
                    placeholder="Edit text here..."></textarea>
            </div>
        {:else}
            <!-- Slides Grid -->
            <div
                bind:this={scrollContainer}
                class="flex-1 overflow-y-auto min-h-0 space-y-6 pb-6 scroll-smooth scrollbar-none"
            >
                {#each presentation.activeCue.sections as section}
                    {@const isActiveSection = section.slides.some(
                        (s) => s.id === presentation.activeSlideId,
                    )}

                    <div
                        id={`section-for-${section.id}`}
                        class="space-y-3 transition-opacity duration-200"
                    >
                        <!-- Section Header -->
                        <div class="flex items-center gap-2 sticky left-0">
                            <div
                                class="h-4 w-4 rounded-sm shadow-sm"
                                style="background-color: {section.color ||
                                    '#4f46e5'}"
                            ></div>
                            <h3
                                class="text-xs font-bold text-muted-foreground uppercase tracking-wider"
                            >
                                {section.title}
                            </h3>
                        </div>

                        <!-- Horizontal Slide Strip -->
                        <!-- ADDED ID for horizontal scrolling -->
                        <div
                            id={`scroll-x-for-${section.id}`}
                            class="flex flex-nowrap overflow-x-auto gap-3 pb-3 scrollbar-none scroll-smooth"
                        >
                            {#each section.slides as slide}
                                <!-- ADDED ID to slide button -->
                                <button
                                    id={`slide-${slide.id}`}
                                    onclick={() =>
                                        presentation.fire(
                                            presentation.activeCue!,
                                            section.id,
                                            slide.id,
                                        )}
                                    class="shrink-0 w-56 h-32 relative flex flex-col items-start justify-start p-4 text-left rounded-xl bg-card border transition-all duration-100 hover:border-neon-cyan/50 hover:bg-neon-violet/10 overflow-hidden
                                        {presentation.activeSlideId === slide.id
                                        ? 'border-neon-cyan ring-1 ring-neon-cyan shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                                        : 'border-border'}"
                                >
                                    <!-- Foreground Media Preview Thumbnail -->
                                    {#if slide.media}
                                        <div
                                            class="absolute inset-0 bg-zinc-900 pointer-events-none"
                                        >
                                            {#if slide.media.type === "video"}
                                                <!-- Use #t=0.1 to just show the first frame instead of autoplaying everywhere -->
                                                <video
                                                    src="{slide.media
                                                        .url}#t=0.1"
                                                    class="w-full h-full object-cover opacity-60"
                                                    preload="metadata"
                                                    muted
                                                ></video>
                                                <div
                                                    class="absolute bottom-2 left-2 bg-black/60 p-1.5 rounded-md backdrop-blur-sm"
                                                >
                                                    <Video
                                                        size={14}
                                                        class="text-white"
                                                    />
                                                </div>
                                            {:else}
                                                <img
                                                    src={slide.media.url}
                                                    alt="Preview"
                                                    class="w-full h-full object-cover opacity-60"
                                                />
                                                <div
                                                    class="absolute bottom-2 left-2 bg-black/60 p-1.5 rounded-md backdrop-blur-sm"
                                                >
                                                    <ImageIcon
                                                        size={14}
                                                        class="text-white"
                                                    />
                                                </div>
                                            {/if}
                                        </div>
                                    {:else}
                                        <!-- Normal Text Preview -->
                                        <span
                                            class="text-[15px] font-medium text-foreground whitespace-pre-wrap line-clamp-4 leading-relaxed z-10"
                                        >
                                            {slide.text || "(Blank Slide)"}
                                        </span>
                                    {/if}

                                    {#if slide.notes}
                                        <div
                                            class="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-yellow-500 shadow-sm z-10"
                                            title="Has stage notes"
                                        ></div>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
{:else}
    <!-- Empty State -->
    <div
        class="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4"
    >
        <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-16 h-16 opacity-30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
        </svg>
        <p class="text-sm">
            Select a cue from the library or playlist to begin.
        </p>
    </div>
{/if}
