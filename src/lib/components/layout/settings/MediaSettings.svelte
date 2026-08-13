<!-- src/lib/components/layout/settings/MediaSettings.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import { media } from "$lib/state/media.svelte";
    import {
        FolderOpen,
        Plus,
        Edit2,
        Trash2,
        Check,
        X,
        Image as ImageIcon,
    } from "@lucide/svelte";

    let newCategoryName = $state("");

    let editingCat = $state<string | null>(null);
    let editName = $state("");

    // Smart Delete State
    let deletingCat = $state<string | null>(null);
    let fallbackCat = $state("Uncategorized");

    onMount(() => {
        if (media.allMedia.length === 0) {
            media.loadAll();
        }
    });

    function getCount(category: string) {
        return media.allMedia.filter((m) => m.category === category).length;
    }

    async function handleAdd() {
        if (newCategoryName.trim()) {
            await media.addCategory(newCategoryName);
            newCategoryName = "";
        }
    }

    function startEdit(cat: string) {
        editingCat = cat;
        editName = cat;
        deletingCat = null;
    }

    async function saveEdit() {
        if (editingCat && editName.trim() && editName.trim() !== editingCat) {
            await media.renameCategory(editingCat, editName);
        }
        editingCat = null;
    }

    function startDelete(cat: string) {
        deletingCat = cat;
        fallbackCat = "Uncategorized"; // Default fallback
        editingCat = null;
    }

    async function confirmDelete() {
        if (deletingCat) {
            await media.deleteCategory(deletingCat, fallbackCat);
        }
        deletingCat = null;
    }

    function focusInput(node: HTMLInputElement) {
        setTimeout(() => {
            node.focus();
            // node.select();
        }, 10);
    }
</script>

<div
    class="max-w-3xl space-y-8 animate-in fade-in duration-300 flex flex-col h-full pb-10"
>
    <!-- Header -->
    <div class="shrink-0">
        <h1
            class="text-2xl font-bold text-foreground mb-2 flex items-center gap-3"
        >
            <FolderOpen size={24} class="text-neon-cyan" />
            Media Categories
        </h1>
        <p class="text-sm text-muted-foreground">
            Create, rename, or delete media categories to keep your workspace
            organized. Deleting a category will safely move its media to another
            category of your choice.
        </p>
    </div>

    <!-- Add New Category -->
    <div
        class="flex items-center gap-3 shrink-0 bg-card border border-border p-4 rounded-xl shadow-sm"
    >
        <div class="relative flex-1">
            <FolderOpen
                size={16}
                class="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500"
            />
            <input
                type="text"
                placeholder="New Category Name..."
                bind:value={newCategoryName}
                onkeydown={(e) => e.key === "Enter" && handleAdd()}
                class="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-colors outline-none"
            />
        </div>
        <button
            onclick={handleAdd}
            disabled={!newCategoryName.trim()}
            class="bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed border border-neon-cyan/30 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"
        >
            <Plus size={16} /> Add
        </button>
    </div>

    <!-- Category List -->
    <div
        class="flex-1 overflow-y-auto bg-card border border-border rounded-xl shadow-sm custom-scrollbar"
    >
        <div class="divide-y divide-border">
            {#each media.categories as category}
                {@const count = getCount(category)}
                {@const isUncat = category === "Uncategorized"}
                {@const isEditing = editingCat === category}
                {@const isDeleting = deletingCat === category}

                <div
                    class="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors {isDeleting
                        ? 'bg-red-500/5'
                        : ''}"
                >
                    <!-- LEFT SIDE: Info or Edit Input -->
                    <div class="flex items-center gap-4 flex-1">
                        {#if isEditing}
                            <input
                                type="text"
                                bind:value={editName}
                                use:focusInput
                                onkeydown={(e) => {
                                    if (e.key === "Enter") saveEdit();
                                    if (e.key === "Escape") editingCat = null;
                                }}
                                class="flex-1 bg-zinc-900 border border-violet-500 rounded-md px-3 py-1.5 text-sm text-zinc-100 outline-none"
                            />
                        {:else}
                            <div class="flex flex-col gap-1">
                                <span
                                    class="text-sm font-bold text-foreground flex items-center gap-2"
                                >
                                    {category}
                                    {#if isUncat}
                                        <span
                                            class="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest"
                                            >Default</span
                                        >
                                    {/if}
                                </span>
                                <span
                                    class="text-xs text-muted-foreground flex items-center gap-1.5 font-medium"
                                >
                                    <ImageIcon size={12} />
                                    {count} items
                                </span>
                            </div>
                        {/if}
                    </div>

                    <!-- RIGHT SIDE: Actions or Confirmations -->
                    <div class="flex items-center gap-2 shrink-0">
                        {#if isEditing}
                            <!-- Edit Confirm -->
                            <button
                                onclick={saveEdit}
                                class="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-md transition-colors"
                                title="Save"
                            >
                                <Check size={16} />
                            </button>
                            <button
                                onclick={() => (editingCat = null)}
                                class="p-2 bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
                                title="Cancel"
                            >
                                <X size={16} />
                            </button>
                        {:else if isDeleting}
                            <!-- Smart Delete Confirm -->
                            <div
                                class="flex flex-col sm:flex-row items-end sm:items-center gap-3 animate-in slide-in-from-right-4 duration-200"
                            >
                                <div class="flex items-center gap-2 text-xs">
                                    <span class="text-red-400 font-medium"
                                        >Move {count} items to:</span
                                    >
                                    <select
                                        bind:value={fallbackCat}
                                        class="bg-zinc-900 border border-zinc-700 rounded text-xs px-2 py-1 outline-none focus:border-red-500 text-zinc-200"
                                    >
                                        {#each media.categories.filter((c) => c !== category) as fallbackOpt}
                                            <option value={fallbackOpt}
                                                >{fallbackOpt}</option
                                            >
                                        {/each}
                                    </select>
                                </div>
                                <div class="flex gap-2">
                                    <button
                                        onclick={() => (deletingCat = null)}
                                        class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-bold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onclick={confirmDelete}
                                        class="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold transition-colors shadow-lg"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        {:else}
                            <!-- Standard Actions -->
                            {#if !isUncat}
                                <button
                                    onclick={() => startEdit(category)}
                                    class="p-2 text-zinc-500 hover:text-neon-cyan hover:bg-neon-cyan/10 rounded-md transition-colors"
                                    title="Rename Category"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onclick={() => startDelete(category)}
                                    class="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                    title="Delete Category"
                                >
                                    <Trash2 size={16} />
                                </button>
                            {/if}
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>
