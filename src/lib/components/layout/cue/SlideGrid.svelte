<!-- src/lib/components/layout/cue/SlideGrid.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import {
        X,
        Save,
        Image as ImageIcon,
        Video,
        BookOpen,
        Search,
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

    let isBibleCue = $derived(
        (presentation.activeCue as any)?.type === "bible",
    );

    // --- IN-CUE LYRIC JUMP STATE ---
    let isLyricJumping = $state(false);
    let lyricQuery = $state("");
    let selectedMatchIndex = $state(0);
    let lyricInputRef = $state<HTMLInputElement | null>(null);

    function stripHtml(html: string): string {
        return html
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    let matchedSlides = $derived.by(() => {
        const q = lyricQuery.trim().toLowerCase();
        if (!isLyricJumping || !q || !presentation.activeCue) return [];

        const matches: { sectionId: string; slideId: string }[] = [];
        for (const section of presentation.activeCue.sections) {
            for (const slide of section.slides) {
                if (
                    slide.text &&
                    stripHtml(slide.text).toLowerCase().includes(q)
                ) {
                    matches.push({ sectionId: section.id, slideId: slide.id });
                }
            }
        }
        return matches;
    });

    let matchedSlideIds = $derived(
        new Set(matchedSlides.map((m) => m.slideId)),
    );

    let activeMatchSlideId = $derived(
        matchedSlides[selectedMatchIndex]?.slideId ?? null,
    );

    // Reset match index when query changes
    $effect(() => {
        lyricQuery;
        selectedMatchIndex = 0;
    });

    // Close lyric jump if cue changes
    $effect(() => {
        presentation.activeCue?.id;
        isLyricJumping = false;
        lyricQuery = "";
    });

    // Auto-scroll to the highlighted search match
    $effect(() => {
        if (isLyricJumping && activeMatchSlideId && scrollContainer) {
            const el = document.getElementById(`slide-${activeMatchSlideId}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    });

    function openLyricJump() {
        if (isBibleCue || isQuickEditing || !presentation.activeCue) return;
        isLyricJumping = true;
        lyricQuery = "";
        selectedMatchIndex = 0;
        setTimeout(() => lyricInputRef?.focus(), 30);
    }

    function closeLyricJump() {
        isLyricJumping = false;
        lyricQuery = "";
        selectedMatchIndex = 0;
    }

    function handleLyricJumpKeydown(e: KeyboardEvent) {
        if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
            if (matchedSlides.length > 0) {
                e.preventDefault();
                selectedMatchIndex =
                    (selectedMatchIndex + 1) % matchedSlides.length;
            }
        } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
            if (matchedSlides.length > 0) {
                e.preventDefault();
                selectedMatchIndex =
                    (selectedMatchIndex - 1 + matchedSlides.length) %
                    matchedSlides.length;
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            const target = matchedSlides[selectedMatchIndex];
            if (target && presentation.activeCue) {
                presentation.fire(
                    presentation.activeCue,
                    target.sectionId,
                    target.slideId,
                );
                closeLyricJump();
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            closeLyricJump();
        }
    }

    onMount(() => {
        const handleJumpShortcut = () => {
            if (!isBibleCue && !isQuickEditing && presentation.activeCue) {
                openLyricJump();
            }
        };

        const handleEscape = () => {
            if (isLyricJumping) closeLyricJump();
        };

        window.addEventListener("shortcut-verse-jump", handleJumpShortcut);
        window.addEventListener("shortcut-escape", handleEscape);

        return () => {
            window.removeEventListener(
                "shortcut-verse-jump",
                handleJumpShortcut,
            );
            window.removeEventListener("shortcut-escape", handleEscape);
        };
    });

    // Fallback color resolver for any sections without an explicit color property
    function getSectionColor(section: any): string {
        if (section.color) return section.color;
        const t = (section.type || section.title || "").toLowerCase();
        if (t.includes("chorus") && !t.includes("pre")) return "#8b5cf6"; // Neon Violet
        if (t.includes("pre")) return "#06b6d4"; // Cyan
        if (t.includes("bridge")) return "#f59e0b"; // Amber
        if (t.includes("vamp")) return "#ec4899"; // Pink
        if (t.includes("end") || t.includes("outro") || t.includes("tag"))
            return "#10b981"; // Emerald
        if (t.includes("verse")) return "#3b82f6"; // Blue
        return "#6366f1"; // Indigo default
    }

    function jumpToSection(section: any) {
        if (!presentation.activeCue || !section?.slides?.length) return;
        presentation.fire(
            presentation.activeCue,
            section.id,
            section.slides[0].id,
        );
    }

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
            { root: null, rootMargin: "300px" },
        );

        observer.observe(node);
        return {
            destroy() {
                observer.disconnect();
            },
        };
    }

    // One-way vertical auto-scroll to active section/slide
    $effect(() => {
        if (
            presentation.activeSlideId &&
            presentation.activeCue &&
            scrollContainer &&
            !isLyricJumping
        ) {
            setTimeout(() => {
                const activeSlideElement = document.getElementById(
                    `slide-${presentation.activeSlideId}`,
                );

                if (activeSlideElement && scrollContainer) {
                    const containerRect =
                        scrollContainer.getBoundingClientRect();
                    const slideRect =
                        activeSlideElement.getBoundingClientRect();
                    const isVisible =
                        slideRect.top >= containerRect.top + 16 &&
                        slideRect.bottom <= containerRect.bottom - 16;

                    if (!isVisible) {
                        const offset = slideRect.top - containerRect.top;
                        scrollContainer.scrollTo({
                            top: scrollContainer.scrollTop + offset - 72,
                            behavior: "smooth",
                        });
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
                            title="({formatShortcut(SHORTCUTS.ESCAPE)})"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            icon={Save}
                            onclick={onSaveEdit}
                            title="({formatShortcut(SHORTCUTS.SAVE_EDIT)})"
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
            <!-- IN-CUE LYRIC JUMP BAR (Active when '/' or 'F' is pressed) -->
            {#if isLyricJumping}
                <div
                    class="shrink-0 mb-3 flex items-center gap-3 bg-zinc-900/95 border-2 border-amber-400/80 px-3.5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(251,191,36,0.15)] animate-in fade-in slide-in-from-top-1 duration-150"
                >
                    <Search size={18} class="text-amber-400 shrink-0" />
                    <input
                        bind:this={lyricInputRef}
                        bind:value={lyricQuery}
                        onkeydown={handleLyricJumpKeydown}
                        type="text"
                        placeholder="Jump to lyric phrase..."
                        class="flex-1 bg-transparent text-sm font-semibold text-white placeholder:text-zinc-500 outline-none"
                        autocomplete="off"
                        spellcheck="false"
                    />

                    {#if lyricQuery.trim()}
                        <span
                            class="text-xs font-mono font-bold px-2 py-0.5 rounded {matchedSlides.length >
                            0
                                ? 'bg-amber-400/20 text-amber-300'
                                : 'bg-red-500/20 text-red-400'}"
                        >
                            {matchedSlides.length > 0
                                ? `${selectedMatchIndex + 1} / ${matchedSlides.length}`
                                : "No match"}
                        </span>
                    {/if}

                    <div
                        class="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider shrink-0"
                    >
                        <kbd
                            class="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300"
                        >
                            ↑↓
                        </kbd>
                        <span>Cycle</span>
                        <kbd
                            class="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300"
                        >
                            Enter
                        </kbd>
                        <span>Fire</span>
                    </div>

                    <button
                        type="button"
                        onclick={closeLyricJump}
                        class="p-1 text-zinc-500 hover:text-white rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Close (Esc)"
                    >
                        <X size={16} />
                    </button>
                </div>
            {/if}

            <!-- STICKY SECTION JUMP BAR (Non-Bible Cues) -->
            {#if !isBibleCue}
                <div
                    class="shrink-0 pb-4 mb-2 border-b border-border/60 flex flex-wrap items-center gap-2"
                >
                    {#if presentation.activeCue.sections.length > 1}
                        {#each presentation.activeCue.sections as section, idx (section.id)}
                            {@const color = getSectionColor(section)}
                            {@const isActive = section.slides.some(
                                (s) => s.id === presentation.activeSlideId,
                            )}
                            <button
                                type="button"
                                onclick={() => jumpToSection(section)}
                                title={idx < 9
                                    ? `Press ${idx + 1} to jump to ${section.title}`
                                    : `Jump to ${section.title}`}
                                class="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border {isActive
                                    ? 'text-white shadow-sm'
                                    : 'bg-zinc-900/70 text-zinc-400 border-zinc-800 hover:text-zinc-100 hover:bg-zinc-800/80'}"
                                style={isActive
                                    ? `background-color: ${color}25; border-color: ${color}; box-shadow: 0 0 12px ${color}33;`
                                    : `border-left: 3px solid ${color};`}
                            >
                                {#if idx < 9}
                                    <kbd
                                        class="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded leading-none {isActive
                                            ? 'bg-black/40 text-white'
                                            : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}"
                                    >
                                        {idx + 1}
                                    </kbd>
                                {/if}
                                <span>{section.title}</span>
                            </button>
                        {/each}
                    {/if}

                    <!-- Mouse Trigger for In-Cue Lyric Jump -->
                    {#if !isLyricJumping}
                        <button
                            type="button"
                            onclick={openLyricJump}
                            title="Press '/' or 'F' to jump to a lyric"
                            class="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-400 bg-zinc-900/70 border border-zinc-800 hover:text-amber-300 hover:border-amber-400/40 hover:bg-zinc-800/80 transition-all cursor-pointer"
                        >
                            <Search size={13} />
                            <span>Find Lyric</span>
                            <kbd
                                class="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-400 rounded leading-none"
                            >
                                /
                            </kbd>
                        </button>
                    {/if}
                </div>
            {/if}

            <!-- ONE-WAY VERTICAL SLIDES GRID -->
            <div
                bind:this={scrollContainer}
                class="flex-1 overflow-y-auto min-h-0 space-y-6 pb-8 pt-2 scroll-smooth custom-scrollbar"
            >
                {#each presentation.activeCue.sections as section, idx (section.id)}
                    {@const color = getSectionColor(section)}
                    {@const isActiveSection = section.slides.some(
                        (s) => s.id === presentation.activeSlideId,
                    )}

                    <div id={`section-for-${section.id}`} class="space-y-3">
                        <!-- Sleek Color-Coded Section Header Bar -->
                        <div class="flex items-center gap-2.5">
                            <div
                                class="h-4 w-1.5 rounded-full shrink-0"
                                style="background-color: {color}; box-shadow: 0 0 8px {color}80;"
                            ></div>
                            {#if !isBibleCue && idx < 9}
                                <span
                                    class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
                                >
                                    {idx + 1}
                                </span>
                            {/if}
                            <h3
                                class="text-xs font-bold uppercase tracking-wider transition-colors"
                                style="color: {isActiveSection ? color : ''}"
                                class:text-muted-foreground={!isActiveSection}
                            >
                                {section.title}
                            </h3>
                            <div
                                class="flex-1 h-px opacity-30"
                                style="background: linear-gradient(to right, {color}, transparent);"
                            ></div>
                        </div>

                        <!-- Wrapping Grid (No Horizontal Scrolling) -->
                        <div
                            class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3"
                        >
                            {#each section.slides as slide (slide.id)}
                                {@const isFiltering =
                                    isLyricJumping &&
                                    lyricQuery.trim().length > 0}
                                {@const isMatch = matchedSlideIds.has(slide.id)}
                                {@const isSelectedMatch =
                                    activeMatchSlideId === slide.id}
                                {@const isLive =
                                    presentation.activeSlideId === slide.id}

                                <button
                                    id={`slide-${slide.id}`}
                                    use:lazyLoadSlide={{
                                        verseId: slide.verseId,
                                        text: slide.text,
                                    }}
                                    onclick={() => {
                                        presentation.fire(
                                            presentation.activeCue!,
                                            section.id,
                                            slide.id,
                                        );
                                        if (isLyricJumping) closeLyricJump();
                                    }}
                                    class="w-full h-32 relative flex flex-col items-start justify-start p-3.5 text-left rounded-xl bg-card border transition-all duration-150 hover:border-neon-cyan/50 hover:bg-neon-violet/10 overflow-hidden cursor-pointer {isSelectedMatch
                                        ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
                                        : isLive
                                          ? 'border-neon-cyan ring-1 ring-neon-cyan shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                                          : isFiltering && isMatch
                                            ? 'border-amber-400/50 bg-amber-400/5'
                                            : 'border-border'} {isFiltering &&
                                    !isMatch
                                        ? 'opacity-25'
                                        : 'opacity-100'}"
                                    style="border-top: 2px solid {isSelectedMatch
                                        ? '#fbbf24'
                                        : isLive
                                          ? '#22d3ee'
                                          : `${color}66`};"
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

                                    {#if slide.text && slide.text !== "(Loading...)"}
                                        <div
                                            class="relative z-10 w-full text-[14px] font-medium text-foreground whitespace-pre-wrap line-clamp-4 leading-relaxed {slide.media
                                                ? 'text-white font-bold drop-shadow-md'
                                                : ''}"
                                        >
                                            {@html slide.text}
                                        </div>
                                    {:else if slide.text === "(Loading...)"}
                                        <span
                                            class="relative z-10 text-[14px] font-medium animate-pulse text-zinc-600"
                                        >
                                            (Loading...)
                                        </span>
                                    {:else if !slide.media}
                                        <span
                                            class="relative z-10 text-[14px] font-medium text-zinc-600"
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
