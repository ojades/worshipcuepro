<!-- src/lib/components/layout/OnboardingSetup.svelte -->
<script lang="ts">
    import { open } from "@tauri-apps/plugin-dialog";

    let { onComplete } = $props<{
        onComplete: (mediaPath: string, dbPath: string | null) => void;
    }>();

    let isSelecting = $state(false);
    let isHybridMode = $state(false);

    let selectedMediaPath = $state<string | null>(null);
    let selectedDbPath = $state<string | null>(null);

    async function pickFolder(title: string): Promise<string | null> {
        const path = await open({
            directory: true,
            multiple: false,
            title: title,
        });
        return path && typeof path === "string" ? path : null;
    }

    async function handleSelectMedia() {
        selectedMediaPath = await pickFolder("Select Media/Fonts Workspace");
    }

    async function handleSelectDb() {
        selectedDbPath = await pickFolder("Select Database Location");
    }

    async function finalize() {
        if (!selectedMediaPath) return;
        isSelecting = true;

        try {
            // Pass the split paths up to layout
            onComplete(selectedMediaPath, isHybridMode ? selectedDbPath : null);
        } finally {
            isSelecting = false;
        }
    }
</script>

<div
    class="min-h-screen w-full bg-[#0a0a0a] flex items-center justify-center p-6 font-sans"
>
    <!-- Main Card -->
    <div
        class="relative w-full max-w-md bg-[#121212] border border-gray-800/60 rounded-2xl p-8 shadow-2xl overflow-hidden flex flex-col items-center text-center transition-all"
    >
        <!-- Subtle Neon Glow Effect (Top Center) -->
        <div
            class="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"
        ></div>

        <!-- Icon -->
        <div
            class="mb-6 p-4 bg-gray-800/30 rounded-full border border-gray-700/50 shadow-inner"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-8 h-8 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                />
            </svg>
        </div>

        <h1 class="text-2xl font-semibold text-gray-100 tracking-tight mb-3">
            Welcome to WorshipCuePro
        </h1>
        <p class="text-sm text-gray-400 leading-relaxed mb-6">
            Choose where your assets and database will be saved.
        </p>

        <!-- Toggle Hybrid Mode -->
        <label
            class="flex items-center gap-3 mb-6 cursor-pointer justify-center p-3 w-full bg-gray-900/50 rounded-xl border border-gray-800 transition-colors hover:bg-gray-800/50"
        >
            <input
                type="checkbox"
                bind:checked={isHybridMode}
                class="accent-indigo-500 w-4 h-4 rounded border-gray-700 bg-gray-800"
            />
            <div class="flex flex-col text-left">
                <span class="text-sm font-semibold text-gray-200"
                    >Hybrid Sync</span
                >
                <span class="text-[10px] text-gray-500"
                    >Split Database & Media locations</span
                >
            </div>
        </label>

        <!-- Media Folder Picker -->
        <div class="space-y-2 w-full mb-4 text-left">
            <label
                for="media-folder-label"
                class="text-xs font-bold text-gray-500 uppercase tracking-wider"
                >Media & Fonts Workspace</label
            >
            <button
                id="media-folder-label"
                onclick={handleSelectMedia}
                class="w-full p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors flex justify-between items-center text-left shadow-inner"
            >
                <span class="truncate pr-4"
                    >{selectedMediaPath || "Select Folder..."}</span
                >
                <span
                    class="shrink-0 text-indigo-400 font-bold tracking-wide text-xs uppercase"
                    >Browse</span
                >
            </button>
            {#if isHybridMode}
                <p class="text-[10px] text-gray-500 mt-1">
                    Recommended: Local Sync Folder (Resilio/Syncthing)
                </p>
            {/if}
        </div>

        <!-- Database Folder Picker -->
        {#if isHybridMode}
            <div
                class="space-y-2 w-full mb-6 text-left animate-in slide-in-from-top-4 fade-in duration-300"
            >
                <label
                    for="db-folder-label"
                    class="text-xs font-bold text-gray-500 uppercase tracking-wider"
                    >Database Location</label
                >
                <button
                    id="db-folder-label"
                    onclick={handleSelectDb}
                    class="w-full p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors flex justify-between items-center text-left shadow-inner"
                >
                    <span class="truncate pr-4"
                        >{selectedDbPath || "Select Folder..."}</span
                    >
                    <span
                        class="shrink-0 text-indigo-400 font-bold tracking-wide text-xs uppercase"
                        >Browse</span
                    >
                </button>
                <p class="text-[10px] text-gray-500 mt-1">
                    Recommended: Cloud Sync Folder (Dropbox/OneDrive)
                </p>
            </div>
        {/if}

        <button
            onclick={finalize}
            disabled={isSelecting ||
                !selectedMediaPath ||
                (isHybridMode && !selectedDbPath)}
            class="w-full py-3 px-5 mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl font-semibold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#121212]"
        >
            {isSelecting ? "Configuring..." : "Complete Setup"}
        </button>
    </div>
</div>
