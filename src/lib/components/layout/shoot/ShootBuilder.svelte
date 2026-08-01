<!-- /src/lib/components/layout/shoot/ShootBuilder.svelte -->
<script lang="ts">
    import { dndzone } from "svelte-dnd-action";
    import {
        Plus,
        Play,
        ArrowLeft,
        MonitorPlay,
        Trash2,
        Save,
        X,
    } from "@lucide/svelte";
    import { convertFileSrc } from "@tauri-apps/api/core";
    import { media } from "$lib/state/media.svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { shootState } from "$lib/state/shoot.svelte";
    import ContextMenu, {
        type ContextMenuItem,
    } from "$lib/components/ui/ContextMenu.svelte";

    let {
        shootId,
        initialTitle = "New Shoot",
        initialSlides = [],
        onClose,
    } = $props<{
        shootId: string;
        initialTitle: string;
        initialSlides: any[];
        onClose: () => void;
    }>();

    let currentId = $state(shootId);
    let title = $state(initialTitle);
    let shootSlides = $state<any[]>(initialSlides);

    // Context Menu State
    let contextMenu = $state({
        visible: false,
        x: 0,
        y: 0,
        activeSlide: null as any,
    });

    async function saveShoot() {
        const savedId = await shootState.saveShoot(
            currentId,
            title,
            shootSlides,
        );
        if (savedId) {
            currentId = savedId;
        }
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
        if (
            confirm(
                "Are you sure you want to delete this shoot? This cannot be undone.",
            )
        ) {
            await shootState.deleteShoot(currentId);
            onClose();
        }
    }

    // --- Builder Handlers ---
    function addMediaToShoot(mediaItem: any) {
        const newSlide = {
            id: crypto.randomUUID(),
            media_id: mediaItem.id,
            filepath: mediaItem.filepath,
            media_type: mediaItem.type,
            asset_url: convertFileSrc(mediaItem.filepath),
        };
        shootSlides = [...shootSlides, newSlide];
    }

    function handleDndConsider(e: CustomEvent) {
        shootSlides = e.detail.items;
    }

    function handleDndFinalize(e: CustomEvent) {
        shootSlides = e.detail.items;
    }

    function removeSlide(slideId: string) {
        shootSlides = shootSlides.filter((s) => s.id !== slideId);
        closeContextMenu();
    }

    async function handleBack() {
        const isDefaultTitle = title.startsWith("New Shoot");
        const isEmpty = shootSlides.length === 0;

        if (isEmpty && isDefaultTitle) {
            onClose();
            return;
        }

        await saveShoot();
        onClose();
    }

    // --- Context Menu Configuration ---
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

    // Reactively generate the menu options depending on which slide is active
    let menuItems = $derived<ContextMenuItem[]>(
        contextMenu.activeSlide
            ? [
                  {
                      type: "action",
                      label: "Remove from Shoot",
                      icon: Trash2,
                      danger: true,
                      onClick: () => removeSlide(contextMenu.activeSlide.id),
                  },
                  { type: "divider" },
                  {
                      type: "action",
                      label: "Move to Front",
                      onClick: () => {
                          const index = shootSlides.findIndex(
                              (s) => s.id === contextMenu.activeSlide.id,
                          );
                          if (index > 0) {
                              // Create a copy to maintain Svelte 5 reactivity
                              const arr = [...shootSlides];
                              const [slide] = arr.splice(index, 1);
                              shootSlides = [slide, ...arr];
                          }
                          closeContextMenu();
                      },
                  },
                  {
                      type: "action",
                      label: "Move to Back",
                      onClick: () => {
                          const index = shootSlides.findIndex(
                              (s) => s.id === contextMenu.activeSlide.id,
                          );
                          if (index < shootSlides.length - 1) {
                              const arr = [...shootSlides];
                              const [slide] = arr.splice(index, 1);
                              shootSlides = [...arr, slide];
                          }
                          closeContextMenu();
                      },
                  },
              ]
            : [],
    );
</script>

<div class="flex h-full animate-in fade-in zoom-in-95 duration-200 w-full">
    <!-- LEFT PANE: Media Pool -->
    <div class="w-1/3 max-w-sm border-r border-border flex flex-col bg-card/30">
        <div class="p-4 border-b border-border bg-background/50">
            <h2
                class="font-bold text-sm text-muted-foreground uppercase tracking-wider"
            >
                Asset Pool
            </h2>
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
                        <video
                            src="{convertFileSrc(mediaItem.filepath)}#t=0.1"
                            class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            muted
                        ></video>
                    {:else}
                        <img
                            src={convertFileSrc(mediaItem.filepath)}
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

    <!-- RIGHT PANE: Storyboard -->
    <div class="flex-1 flex flex-col bg-background relative">
        <!-- Builder Header -->
        <div
            class="px-6 py-4 border-b border-border flex items-center justify-between bg-card/10 shrink-0"
        >
            <div class="flex items-center gap-4">
                <button
                    onclick={handleBack}
                    class="p-2 hover:bg-zinc-800 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    title="Save & Close"
                >
                    <ArrowLeft size={20} />
                </button>
                <input
                    type="text"
                    bind:value={title}
                    class="text-xl font-bold bg-transparent outline-none border-b border-transparent focus:border-neon-violet pb-0.5 text-foreground placeholder:text-muted-foreground/50"
                    placeholder="Shoot Title..."
                />
            </div>

            <div class="flex items-center gap-3">
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
            </div>
        </div>

        <!-- Storyboard Grid -->
        <div class="flex-1 p-6 overflow-y-auto custom-scrollbar">
            {#if shootSlides.length === 0}
                <div
                    class="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60"
                >
                    <MonitorPlay size={48} class="mb-4 opacity-20" />
                    <p class="font-medium">No slides in this shoot yet</p>
                    <p class="text-sm mt-1">
                        Click items in the asset pool to add them
                    </p>
                </div>
            {:else}
                <div
                    class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 outline-none pb-24"
                    use:dndzone={{
                        items: shootSlides,
                        flipDurationMs: 200,
                        dropTargetStyle: {},
                    }}
                    onconsider={handleDndConsider}
                    onfinalize={handleDndFinalize}
                >
                    {#each shootSlides as slide (slide.id)}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div
                            class="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-sm cursor-grab active:cursor-grabbing group"
                            oncontextmenu={(e) => openContextMenu(e, slide)}
                        >
                            {#if slide.media_type === "video"}
                                <video
                                    src="{slide.asset_url}#t=0.1"
                                    class="w-full h-full object-cover"
                                    muted
                                ></video>
                            {:else}
                                <img
                                    src={slide.asset_url}
                                    alt="slide"
                                    class="w-full h-full object-cover"
                                />
                            {/if}

                            <!-- Slide Number Badge -->
                            <div
                                class="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold text-white backdrop-blur-sm pointer-events-none"
                            >
                                {shootSlides.indexOf(slide) + 1}
                            </div>

                            <!-- Quick Remove Slide Button -->
                            <button
                                class="absolute top-2 right-2 bg-red-500/90 hover:bg-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    removeSlide(slide.id);
                                }}
                                title="Remove Slide"
                            >
                                <X size={14} class="text-white" />
                            </button>
                        </div>
                    {/each}
                </div>
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
