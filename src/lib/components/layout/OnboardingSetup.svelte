<!-- src/lib/components/OnboardingSetup.svelte -->
<script lang="ts">
    import { open } from "@tauri-apps/plugin-dialog";

    let { onComplete } = $props<{ onComplete: (path: string) => void }>();

    async function selectFolder() {
        const selectedPath = await open({
            directory: true,
            multiple: false,
            title: "Select WorshipCuePro Workspace Folder",
        });

        if (selectedPath && typeof selectedPath === "string") {
            onComplete(selectedPath);
        }
    }
</script>

<div class="setup-container">
    <h1>Welcome to WorshipCuePro</h1>
    <p>
        To get started, please choose a folder where your database, media, and
        playlists will be saved.
    </p>

    <button onclick={selectFolder}> Select Workspace Folder </button>
</div>
