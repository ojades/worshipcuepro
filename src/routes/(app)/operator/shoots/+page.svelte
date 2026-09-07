<script lang="ts">
    import {
        Plus,
        Play,
        MonitorPlay,
        Trash2,
        ListPlus,
        FileDown,
        Loader2,
    } from "@lucide/svelte";
    import { presentation } from "$lib/state/presentation.svelte";
    import { shootState } from "$lib/state/shoot.svelte";
    import ShootBuilder from "$lib/components/layout/shoot/ShootBuilder.svelte";
    import { confirmDialog } from "$lib/utils/helper";
    import AddToPlaylistMenu from "$lib/components/ui/AddToPlaylistMenu.svelte";
    import { open } from "@tauri-apps/plugin-dialog";
    import { mkdir, remove } from "@tauri-apps/plugin-fs";
    import { join, basename, extname } from "@tauri-apps/api/path";
    import { convertFileSrc, invoke } from "@tauri-apps/api/core";
    import { systemState } from "$lib/state/system.svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import { media } from "$lib/state/media.svelte";
    import type { SlideInsert } from "$lib/commands/shoot-db";

    // View State
    let activeView: "list" | "edit" = $state("list");
    let isImporting = $state(false);

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

    async function importPresentation() {
        if (settingsState.isReadOnly) {
            systemState.addAlert({
                message: "Cannot import: Database is in Read-Only mode.",
                type: "warning",
            });
            return;
        }

        const selected = await open({
            title: "Import Presentation",
            filters: [
                { name: "Presentations", extensions: ["pdf", "pptx", "ppt"] },
            ],
            multiple: false,
        });

        if (!selected) return;
        isImporting = true;

        try {
            const filePath = selected as string;
            const ext = await extname(filePath);
            const rawTitle = await basename(filePath, `.${ext}`);
            const title = getUniqueTitle(rawTitle);

            systemState.addAlert({
                message: "Converting presentation slides... please wait.",
                type: "info",
            });

            const outDir = await join(
                settingsState.workspacePath,
                "presentations",
                title,
            );
            await mkdir(outDir, { recursive: true });

            let slideImages: string[] = [];

            if (ext.toLowerCase().startsWith("ppt")) {
                const tempPdf = await invoke<string>("convert_pptx_to_pdf", {
                    inputPptx: filePath,
                    outputDir: outDir,
                });
                slideImages = await invoke<string[]>("convert_pdf_to_slides", {
                    pdfPath: tempPdf,
                    outputDir: outDir,
                });

                // Clean up the temporary PDF created during PPTX conversion
                await remove(tempPdf).catch(() => {});
            } else {
                slideImages = await invoke<string[]>("convert_pdf_to_slides", {
                    pdfPath: filePath,
                    outputDir: outDir,
                });
            }

            if (slideImages.length === 0) {
                throw new Error("No slides could be extracted.");
            }

            // Register the generated images as Media assets
            const mediaInserts = slideImages.map((path, i) => ({
                id: crypto.randomUUID(),
                filename: `${title} - Slide ${i + 1}`,
                filepath: path,
                type: "image",
                category: "Presentation",
            }));

            // Bulk insert into the SQLite media table
            await invoke("bulk_insert_media", { items: mediaInserts });
            await media.loadAll();

            // Create the Shoot linked to the newly registered media
            const shootSlides: SlideInsert[] = mediaInserts.map((m) => ({
                media_id: m.id,
            }));

            await shootState.saveShoot(null, title, shootSlides);

            systemState.addAlert({
                message: "Presentation imported successfully!",
                type: "success",
            });
        } catch (error) {
            console.error("Import failed:", error);
            systemState.addAlert({
                message: `Failed to import presentation. Ensure LibreOffice is installed if importing PPTX.`,
                type: "error",
                timeout: 8000,
            });
        } finally {
            isImporting = false;
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
                <div class="flex items-center gap-3">
                    <!-- NEW IMPORT BUTTON -->
                    <button
                        onclick={importPresentation}
                        disabled={isImporting}
                        class="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {#if isImporting}
                            <Loader2
                                size={18}
                                class="animate-spin text-neon-violet"
                            />
                            Importing...
                        {:else}
                            <FileDown size={18} /> Import PPTX/PDF
                        {/if}
                    </button>

                    <button
                        onclick={createNewShoot}
                        class="bg-neon-violet hover:bg-neon-violet/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-neon-violet/20"
                    >
                        <Plus size={18} /> New Shoot
                    </button>
                </div>
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
                            class="flex-1 bg-zinc-900/50 flex items-center justify-center text-zinc-700 group-hover:text-neon-violet/40 transition-colors rounded-t-xl overflow-hidden relative"
                        >
                            {#if shoot.thumbnail_path}
                                <img
                                    src={convertFileSrc(shoot.thumbnail_path)}
                                    alt={shoot.title}
                                    class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                />
                            {:else}
                                <MonitorPlay size={40} strokeWidth={1.5} />
                            {/if}
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
