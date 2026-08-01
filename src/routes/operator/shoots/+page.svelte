<!-- /src/routes/operator/shoots/+page.svelte -->
<script lang="ts">
    import { Plus, Play, MonitorPlay, Trash2, ListPlus } from "@lucide/svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { shootState } from "$lib/state/shoot.svelte";
    import ShootBuilder from "$lib/components/layout/shoot/ShootBuilder.svelte";
    import { confirmDialog } from "$lib/utils/helper";
    import AddToPlaylistMenu from "$lib/components/ui/AddToPlaylistMenu.svelte";

    // View State
    let activeView: "list" | "edit" = $state("list");

    let builderProps = $state({
        id: "",
        title: "",
        slides: [] as any[],
    });

    async function fireShoot(id: string) {
        const cue = await shootState.getShoot(id);
        presentation.fire(cue);
    }

    function getUniqueTitle(baseTitle: string) {
        let title = baseTitle;
        let counter = 1;

        const existingTitles = shootState.allShoots.map((s) => s.title);

        while (existingTitles.includes(title)) {
            title = `${baseTitle} ${counter}`;
            counter++;
        }
        return title;
    }

    function createNewShoot() {
        builderProps = {
            id: crypto.randomUUID(),
            title: getUniqueTitle("New Shoot"),
            slides: [],
        };
        activeView = "edit";
    }

    async function editShoot(shoot: any) {
        // Just ask the state layer for the prepared slides
        const slides = await shootState.getShootSlides(shoot.id);

        builderProps = {
            id: shoot.id,
            title: shoot.title,
            slides: slides,
        };

        activeView = "edit";
    }

    async function confirmDelete(id: string, e?: Event) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const answer = await confirmDialog({
            message:
                "Are you sure you want to delete this shoot? This cannot be undone.",
            title: "Delete Shoot",
        });
        if (answer) {
            await shootState.deleteShoot(id);
        }
    }
</script>

<div class="h-full bg-background overflow-hidden relative">
    {#if activeView === "list"}
        <!-- ================= LIST VIEW ================= -->
        <div class="p-6 h-full flex flex-col">
            <div class="flex items-center justify-between mb-8">
                <div>
                    <h1 class="text-2xl font-bold text-foreground">Shoots</h1>
                    <p class="text-sm text-muted-foreground mt-1">
                        Manage presentation slide collections
                    </p>
                </div>
                <button
                    onclick={createNewShoot}
                    class="bg-neon-violet hover:bg-neon-violet/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-neon-violet/20"
                >
                    <Plus size={18} /> New Shoot
                </button>
            </div>

            <!-- Shoots Grid -->
            <div
                class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto custom-scrollbar pb-10"
            >
                {#each shootState.allShoots as shoot}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="group relative bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-neon-violet/50 transition-all flex flex-col h-40"
                        onclick={() => editShoot(shoot)}
                    >
                        <div
                            class="flex-1 bg-zinc-900/50 flex items-center justify-center text-zinc-700 group-hover:text-neon-violet/40 transition-colors rounded-t-xl"
                        >
                            <MonitorPlay size={40} strokeWidth={1.5} />
                        </div>

                        <div
                            class=" p-3 bg-card border-t border-border shrink-0 flex justify-between items-center"
                        >
                            <div class="truncate pr-2">
                                <h3
                                    class="font-semibold text-sm text-foreground truncate"
                                >
                                    {shoot.title}
                                </h3>
                                <p class="text-xs text-muted-foreground mt-0.5">
                                    {shoot.slideCount} slides
                                </p>
                            </div>

                            <div
                                class="flex items-center gap-1 absolute bottom-1 left-0 justify-between w-full group-hover:bg-background py-2 px-2"
                            >
                                <AddToPlaylistMenu
                                    cueId={shoot.id}
                                    cueType="shoot"
                                    direction="up"
                                    align="left"
                                >
                                    <button
                                        class="text-muted-foreground hover:text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-neon-cyan/10 rounded-md"
                                        title="Add to Playlist"
                                    >
                                        <ListPlus size={16} />
                                    </button>
                                </AddToPlaylistMenu>

                                <!-- Delete Button -->
                                <button
                                    onclick={(e) => confirmDelete(shoot.id, e)}
                                    class="text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-400/10 rounded-md"
                                    title="Delete Shoot"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div
                            class="absolute inset-x-0 top-0 bottom-[60px] bg-background/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                            <button
                                onclick={(e) => {
                                    e.stopPropagation();
                                    fireShoot(shoot.id);
                                }}
                                class="w-12 h-12 bg-neon-violet text-white rounded-full flex items-center justify-center shadow-lg shadow-neon-violet/30 hover:scale-105 transition-transform"
                                title="Fire Shoot"
                            >
                                <Play size={20} class="fill-current ml-1" />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {:else}
        <!-- ================= EDIT VIEW (STORYBOARD) ================= -->
        <ShootBuilder
            shootId={builderProps.id}
            initialTitle={builderProps.title}
            initialSlides={builderProps.slides}
            onClose={() => (activeView = "list")}
        />
    {/if}
</div>
