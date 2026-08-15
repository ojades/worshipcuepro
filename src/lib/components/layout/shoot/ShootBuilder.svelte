<!-- src/lib/components/layout/shoot/ShootBuilder.svelte -->
<script lang="ts">
    import { untrack } from "svelte";
    import { dndzone } from "svelte-dnd-action";
    import {
        Plus,
        Play,
        ArrowLeft,
        MonitorPlay,
        Trash2,
        Save,
        X,
        Edit3,
        Type,
        Check,
    } from "@lucide/svelte";
    import { media } from "$lib/state/media.svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { shootState } from "$lib/state/shoot.svelte";
    import ContextMenu, {
        type ContextMenuItem,
    } from "$lib/components/ui/ContextMenu.svelte";
    import CanvasEditor from "./CanvasEditor.svelte";

    let {
        shootId,
        initialTitle = "New Shoot",
        initialSlides = [],
        onClose,
    } = $props<{
        shootId: string;
        initialTitle?: string;
        initialSlides?: any[];
        onClose: () => void;
    }>();

    let currentId = $state(untrack(() => shootId));
    let title = $state(untrack(() => initialTitle));
    let shootSlides = $state<any[]>(untrack(() => initialSlides));

    // UI States
    let editingSlideId = $state<string | null>(null);
    let editingSlide = $derived(
        shootSlides.find((s) => s.id === editingSlideId),
    );

    let contextMenu = $state({
        visible: false,
        x: 0,
        y: 0,
        activeSlide: null as any,
    });

    // --- NEW: Lazy Load Action for Media ---
    function lazyLoadMedia(
        node: HTMLImageElement | HTMLVideoElement,
        src: string | null | undefined,
    ) {
        if (!src) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    node.src = src;
                    observer.disconnect(); // Stop observing once loaded
                }
            },
            { rootMargin: "300px" }, // Load slightly before it scrolls into view
        );

        observer.observe(node);

        return {
            update(newSrc: string | null | undefined) {
                if (newSrc && newSrc !== src) {
                    src = newSrc;
                    // If it was already loaded, update it instantly
                    if (node.src) node.src = newSrc;
                }
            },
            destroy() {
                observer.disconnect();
            }
        };
    }

    async function saveShoot() {
        const savedId = await shootState.saveShoot(
            currentId,
            title,
            shootSlides,
        );
        if (savedId) currentId = savedId;
    }

    async function saveAndClose() {
        await saveShoot();
        onClose();
    }

    async function saveAndFire() {
        await saveShoot();
        const cue = await shootState.getShoot(currentId);
        presentation.fire(cue);
    }

    async function confirmDelete() {
        if (confirm("Are you sure you want to delete this shoot?")) {
            await shootState.deleteShoot(currentId);
            onClose();
        }
    }

    function addMediaToShoot(mediaItem: any) {
        shootSlides = [
            ...shootSlides,
            {
                id: crypto.randomUUID(),
                media_id: mediaItem.id,
                filepath: mediaItem.filepath,
                media_type: mediaItem.type,
                asset_url: mediaItem.asset_url,
                text_content: "",
            },
        ];
    }

    function addTextOnlySlide() {
        const newSlide = {
            id: crypto.randomUUID(),
            media_id: null,
            filepath: null,
            media_type: null,
            asset_url: null,
            text_content: "<p>New Text Slide</p>",
        };
        shootSlides = [...shootSlides, newSlide];
        editingSlideId = newSlide.id; // Auto-open editor
    }

    function handleDndConsider(e: CustomEvent) {
        shootSlides = e.detail.items;
    }
    function handleDndFinalize(e: CustomEvent) {
        shootSlides = e.detail.items;
    }

    function removeSlide(slideId: string) {
        shootSlides = shootSlides.filter((s) => s.id !== slideId);
        if (editingSlideId === slideId) editingSlideId = null;
        closeContextMenu();
    }

    async function handleBack() {
        if (editingSlideId) {
            editingSlideId = null;
            return;
        }

        const isDefaultTitle = title.startsWith("New Shoot");
        const isEmpty = shootSlides.length === 0;

        if (isEmpty && isDefaultTitle) {
            onClose();
            return;
        }

        await saveShoot();
        onClose();
    }

    function openContextMenu(e: MouseEvent, slide: any) {
        e.preventDefault();
        e.stopPropagation();
        contextMenu = {
            visible: true,
            x: e.clientX,
            y: e.clientY,
            activeSlide: slide,
        };
    }

    function closeContextMenu() {
        contextMenu.visible = false;
    }

    function updateSlideText(html: string) {
        if (!editingSlideId) return;
        const index = shootSlides.findIndex((s) => s.id === editingSlideId);
        if (index > -1) {
            shootSlides[index].text_content = html;
            shootSlides = [...shootSlides];
        }
    }

    let menuItems = $derived<ContextMenuItem[]>(
        contextMenu.activeSlide
            ? [
                  {
                      type: "action",
                      label: "Edit Canvas",
                      icon: Edit3,
                      onClick: () => {
                          editingSlideId = contextMenu.activeSlide.id;
                          closeContextMenu();
                      },
                  },
                  { type: "divider" },
                  {
                      type: "action",
                      label: "Move to Front",
                      onClick: () => {
                          /* Handle sorting */ closeContextMenu();
                      },
                  },
                  {
                      type: "action",
                      label: "Move to Back",
                      onClick: () => {
                          /* Handle sorting */ closeContextMenu();
                      },
                  },
                  { type: "divider" },
                  {
                      type: "action",
                      label: "Remove Slide",
                      icon: Trash2,
                      danger: true,
                      onClick: () => removeSlide(contextMenu.activeSlide.id),
                  },
              ]
            : [],
    );
</script>

<div class="flex h-full animate-in fade-in zoom-in-95 duration-200 w-full">
    <!-- LEFT PANE: Media Pool (Hidden when editing a slide to maximize canvas space) -->
    {#if !editingSlideId}
        <div
            class="w-1/3 max-w-sm border-r border-border flex flex-col bg-card/30"
        >
            <div
                class="p-4 border-b border-border bg-background/50 flex justify-between items-center"
            >
                <h2
                    class="font-bold text-sm text-muted-foreground uppercase tracking-wider"
                >
                    Asset Pool
                </h2>
            </div>

            <div class="p-4 pb-0">
                <button
                    onclick={addTextOnlySlide}
                    class="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-sm font-semibold text-zinc-300 transition-colors"
                >
                    <Type size={16} /> Add Blank Text Slide
                </button>
            </div>

            <div
                class="p-4 grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar"
            >
                {#each media.allMedia as mediaItem}
                    <button
                        class="relative aspect-video bg-zinc-900 rounded-lg group overflow-hidden border border-border hover:border-neon-cyan transition-colors"
                        onclick={() => addMediaToShoot(mediaItem)}
                    >
                        {#if mediaItem.type === "video"}
                            <!-- svelte-ignore a11y_media_has_caption -->
                            <video
                                use:lazyLoadMedia="{mediaItem.asset_url}#t=0.1"
                                class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                muted
                                preload="none"
                            ></video>
                        {:else}
                            <img
                                use:lazyLoadMedia={mediaItem.asset_url}
                                alt="Asset"
                                class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            />
                        {/if}
                        <div
                            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                            <Plus size={24} class="text-white" />
                        </div>
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    <!-- RIGHT PANE: Storyboard / Editor -->
    <div class="flex-1 flex flex-col bg-background relative transition-all">
        <!-- HEADER -->
        <div
            class="px-6 py-4 border-b border-border flex items-center justify-between bg-card/10 shrink-0"
        >
            <div class="flex items-center gap-4">
                <button
                    onclick={handleBack}
                    class="p-2 hover:bg-zinc-800 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    title={editingSlideId
                        ? "Back to Storyboard"
                        : "Save & Close"}
                >
                    <ArrowLeft size={20} />
                </button>

                {#if editingSlideId}
                    <div class="text-xl font-bold text-foreground">
                        Canvas Editor
                    </div>
                {:else}
                    <input
                        type="text"
                        bind:value={title}
                        class="text-xl font-bold bg-transparent outline-none border-b border-transparent focus:border-neon-violet pb-0.5 text-foreground placeholder:text-muted-foreground/50"
                        placeholder="Shoot Title..."
                    />
                {/if}
            </div>

            <div class="flex items-center gap-3">
                {#if !editingSlideId}
                    <button
                        onclick={confirmDelete}
                        class="text-muted-foreground hover:text-red-400 p-2 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Delete Shoot"
                    >
                        <Trash2 size={18} />
                    </button>
                    <div class="w-px h-6 bg-border mx-1"></div>
                    <button
                        onclick={saveShoot}
                        class="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm transition-all"
                    >
                        <Save size={16} /> Save
                    </button>
                    <button
                        onclick={saveAndFire}
                        class="bg-neon-violet/10 text-neon-violet border border-neon-violet/30 hover:bg-neon-violet hover:text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold text-sm transition-all"
                    >
                        <Play size={16} class="fill-current" /> Fire Shoot
                    </button>
                {:else}
                    <button
                        onclick={() => (editingSlideId = null)}
                        class="bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan hover:text-black px-4 py-2 rounded-lg flex items-center gap-2 font-semibold text-sm transition-all"
                    >
                        <Check size={16} /> Save
                    </button>
                {/if}
            </div>
        </div>

        <!-- CONTENT AREA -->
        <div
            class="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col items-center"
        >
            {#if editingSlideId && editingSlide}
                <!-- ================= CANVAS EDITOR (CLEANED UP) ================= -->
                <CanvasEditor slide={editingSlide} onUpdate={updateSlideText} />
            {:else}
                <!-- ================= GRID VIEW ================= -->
                {#if shootSlides.length === 0}
                    <div
                        class="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-60 w-full h-full"
                    >
                        <MonitorPlay size={48} class="mb-4 opacity-20" />
                        <p class="font-medium">No slides in this shoot yet</p>
                    </div>
                {:else}
                    <div
                        class="w-full grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 outline-none pb-24"
                        use:dndzone={{
                            items: shootSlides,
                            flipDurationMs: 200,
                        }}
                        onconsider={handleDndConsider}
                        onfinalize={handleDndFinalize}
                    >
                        {#each shootSlides as slide (slide.id)}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="relative aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 shadow-sm cursor-grab active:cursor-grabbing group flex items-center justify-center text-center"
                                oncontextmenu={(e) => openContextMenu(e, slide)}
                            >
                                <!-- Background Preview -->
                                {#if slide.media_type === "video"}
                                    <!-- svelte-ignore a11y_media_has_caption -->
                                    <video
                                        use:lazyLoadMedia="{slide.asset_url}#t=0.1"
                                        class="absolute inset-0 w-full h-full object-cover opacity-50"
                                        muted
                                        preload="none"
                                    ></video>
                                {:else if slide.asset_url}
                                    <img
                                        use:lazyLoadMedia={slide.asset_url}
                                        alt="slide"
                                        class="absolute inset-0 w-full h-full object-cover opacity-50"
                                    />
                                {/if}

                                <!-- Text Preview (Strip HTML for thumbnail readability) -->
                                {#if slide.text_content}
                                    <div
                                        class="relative z-10 p-2 text-white font-bold text-[10px] leading-tight line-clamp-3"
                                    >
                                        {@html slide.text_content}
                                    </div>
                                {/if}

                                <div
                                    class="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold text-white z-20"
                                >
                                    {shootSlides.indexOf(slide) + 1}
                                </div>

                                <!-- Hover Actions -->
                                <div
                                    class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-30"
                                >
                                    <button
                                        class="w-10 h-10 bg-zinc-800 hover:bg-neon-cyan hover:text-black text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                                        onclick={() =>
                                            (editingSlideId = slide.id)}
                                        title="Edit Canvas"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button
                                        class="w-10 h-10 bg-zinc-800 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                                        onclick={() => removeSlide(slide.id)}
                                        title="Remove Slide"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</div>

<ContextMenu
    visible={contextMenu.visible}
    x={contextMenu.x}
    y={contextMenu.y}
    items={menuItems}
    onClose={closeContextMenu}
/>
