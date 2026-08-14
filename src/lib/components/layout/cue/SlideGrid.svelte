<!-- src/lib/components/layout/cue/SlideGrid.svelte -->
<script lang="ts">
    import { presentation } from "$lib/state/presentation.svelte";
    import {
        X,
        Save,
        Image as ImageIcon,
        Video,
        BookOpen,
    } from "@lucide/svelte";
    import Button from "$lib/components/ui/Button.svelte";
    import { formatShortcut, SHORTCUTS } from "$lib/utils/shortcuts";
    import { bibleState } from "$lib/state/bible.svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import { chunkProse } from "$lib/utils/helper";

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
    const fetchingSlides = new Set<string>();

    function lazyLoadSlide(
        node: HTMLElement,
        { verseId, text }: { verseId?: string; text: string },
    ) {
        if (!verseId || text !== "(Loading...)") return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !fetchingSlides.has(verseId)) {
                        fetchingSlides.add(verseId);

                        // Disconnect immediately to prevent re-triggering during array swap
                        observer.disconnect();

                        bibleState
                            .resolveVerseText(verseId)
                            .then((newText) => {
                                if (newText && presentation.activeCue) {
                                    const linesPerSlide =
                                        (settingsState.config as any)
                                            .linesPerSlide || 0;
                                    const currentFontScale =
                                        settingsState.config.projector
                                            ?.textScale ?? 1.0;
                                    const versionAbbr =
                                        bibleState.versions.find(
                                            (v) =>
                                                v.id ===
                                                bibleState.selectedVersion,
                                        )?.abbreviation || "Bible";

                                    const newChunks = chunkProse(
                                        newText,
                                        linesPerSlide,
                                        currentFontScale,
                                    );
                                    const sectionIndex =
                                        presentation.activeCue.sections.findIndex(
                                            (s: any) =>
                                                s.id === `verse_${verseId}`,
                                        );

                                    if (sectionIndex !== -1) {
                                        const updatedSlides = newChunks.map(
                                            (chunkText, i, arr) => ({
                                                id: `slide_${verseId}_${i}`,
                                                text: chunkText,
                                                reference: `${presentation.activeCue!.sections[sectionIndex].title} (${versionAbbr})${arr.length > 1 ? ` [${i + 1}/${arr.length}]` : ""}`,
                                                verseId: verseId,
                                            }),
                                        );

                                        // Deep clone array to force Svelte 5 reactivity trigger
                                        const newSections = [
                                            ...presentation.activeCue.sections,
                                        ];
                                        newSections[sectionIndex] = {
                                            ...newSections[sectionIndex],
                                            slides: updatedSlides,
                                        };

                                        presentation.activeCue.sections =
                                            newSections;
                                    }
                                }
                            })
                            .finally(() => {
                                fetchingSlides.delete(verseId);
                            });
                    }
                });
            },
            { root: null, rootMargin: "300px" }, // root: null correctly uses the viewport boundary even inside nested scrolling
        );

        observer.observe(node);
        return {
            destroy() {
                observer.disconnect();
            },
        };
    }

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
                                    40,
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
            <!-- Quick Edit Pane (Unchanged) -->
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
                            >Cancel</Button
                        >
                        <Button
                            variant="primary"
                            icon={Save}
                            onclick={onSaveEdit}
                            title="({formatShortcut(SHORTCUTS.SAVE_EDIT)}}"
                            >Save & Update</Button
                        >
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
                <!-- FIX: Added (section.id) -->
                {#each presentation.activeCue.sections as section (section.id)}
                    {@const isActiveSection = section.slides.some(
                        (s) => s.id === presentation.activeSlideId,
                    )}

                    <div
                        id={`section-for-${section.id}`}
                        class="space-y-3 transition-opacity duration-200"
                    >
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

                        <div
                            id={`scroll-x-for-${section.id}`}
                            class="flex flex-nowrap overflow-x-auto gap-3 pb-3 scrollbar-none scroll-smooth"
                        >
                            <!-- FIX: Added (slide.id) -->
                            {#each section.slides as slide (slide.id)}
                                <button
                                    id={`slide-${slide.id}`}
                                    use:lazyLoadSlide={{
                                        verseId: slide.verseId,
                                        text: slide.text,
                                    }}
                                    onclick={() =>
                                        presentation.fire(
                                            presentation.activeCue!,
                                            section.id,
                                            slide.id,
                                        )}
                                    class="shrink-0 w-56 h-32 relative flex flex-col items-start justify-start p-4 text-left rounded-xl bg-card border transition-all duration-100 hover:border-neon-cyan/50 hover:bg-neon-violet/10 overflow-hidden {presentation.activeSlideId ===
                                    slide.id
                                        ? 'border-neon-cyan ring-1 ring-neon-cyan shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                                        : 'border-border'}"
                                >
                                    {#if slide.media}
                                        <div
                                            class="absolute inset-0 bg-zinc-900 pointer-events-none"
                                        >
                                            {#if slide.media.type === "video"}
                                                <!-- svelte-ignore a11y_media_has_caption -->
                                                <video
                                                    src="{slide.media
                                                        .url}#t=0.1"
                                                    class="w-full h-full object-cover opacity-60"
                                                    preload="metadata"
                                                    muted
                                                ></video>
                                                <div
                                                    class="absolute bottom-2 left-2 bg-black/60 p-1.5 rounded-md backdrop-blur-sm z-20"
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
                                                    class="absolute bottom-2 left-2 bg-black/60 p-1.5 rounded-md backdrop-blur-sm z-20"
                                                >
                                                    <ImageIcon
                                                        size={14}
                                                        class="text-white"
                                                    />
                                                </div>
                                            {/if}
                                        </div>
                                    {/if}

                                    <!-- Text Preview (Strip HTML for thumbnail readability) -->
                                    {#if slide.text && slide.text !== "(Loading...)"}
                                        <!-- Use {@html} to render Tiptap content correctly -->
                                        <div
                                            class="relative z-10 w-full text-[15px] font-medium text-foreground whitespace-pre-wrap line-clamp-4 leading-relaxed {slide.media
                                                ? 'text-white font-bold drop-shadow-md'
                                                : ''}"
                                        >
                                            {@html slide.text}
                                        </div>
                                    {:else if slide.text === "(Loading...)"}
                                        <span
                                            class="relative z-10 text-[15px] font-medium animate-pulse text-zinc-600"
                                        >
                                            (Loading...)
                                        </span>
                                    {:else if !slide.media}
                                        <span
                                            class="relative z-10 text-[15px] font-medium text-zinc-600"
                                        >
                                            (Blank Slide)
                                        </span>
                                    {/if}

                                    {#if slide.notes}
                                        <div
                                            class="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-yellow-500 shadow-sm z-20"
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
    <div
        class="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4"
    >
        <BookOpen size={48} class="opacity-20" />
        <p class="text-lg font-medium">
            Select a cue from the library or playlist to begin.
        </p>
    </div>
{/if}
