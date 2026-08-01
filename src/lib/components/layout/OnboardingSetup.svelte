<!-- src/lib/components/OnboardingSetup.svelte -->
<script lang="ts">
    import { open } from "@tauri-apps/plugin-dialog";

    let { onComplete } = $props<{ onComplete: (path: string) => void }>();
    let isSelecting = $state(false);

    async function selectFolder() {
        if (isSelecting) return;

        isSelecting = true;
        try {
            const selectedPath = await open({
                directory: true,
                multiple: false,
                title: "Select WorshipCuePro Workspace Folder",
            });

            if (selectedPath && typeof selectedPath === "string") {
                onComplete(selectedPath);
            }
        } finally {
            // Reset state if they cancel the dialog
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

        <!-- Typography -->
        <h1 class="text-2xl font-semibold text-gray-100 tracking-tight mb-3">
            Welcome to WorshipCuePro
        </h1>
        <p class="text-sm text-gray-400 leading-relaxed mb-8">
            To get started, please choose a dedicated workspace folder. This is
            where your database, media assets, and playlists will be securely
            saved.
        </p>

        <!-- Neon-Styled Button -->
        <button
            onclick={selectFolder}
            disabled={isSelecting}
            class="w-full group relative flex items-center justify-center gap-2 py-3 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-xl font-medium transition-all duration-300 shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] ring-1 ring-indigo-500/50 disabled:ring-0 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#121212]"
        >
            {#if isSelecting}
                <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                    ></circle>
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
                Opening...
            {:else}
                Select Workspace
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 transition-transform group-hover:translate-x-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fill-rule="evenodd"
                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                    />
                </svg>
            {/if}
        </button>
    </div>
</div>
