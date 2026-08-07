<!-- src/lib/components/layout/settings/ObsSettings.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import { settingsState } from "$lib/state/settings.svelte";
    import { Code2 } from "@lucide/svelte";
    import { presentation } from "$lib/state/presentation.svelte";

    // Initialize with state (fallbacks)
    let lyricTemplate = $state(settingsState.config.obsTemplates?.lyric || "");
    let bibleTemplate = $state(settingsState.config.obsTemplates?.bible || "");

    onMount(async () => {
        // Fetch the cached templates directly from SQLite
        const dbLyric = await settingsState.getDbSetting(
            "obs_template_lyric",
            "",
        );
        const dbBible = await settingsState.getDbSetting(
            "obs_template_bible",
            "",
        );

        if (dbLyric) lyricTemplate = dbLyric;
        if (dbBible) bibleTemplate = dbBible;

        // Ensure the global config state is synced with the DB so the WebSocket uses the latest data
        settingsState.update({
            obsTemplates: {
                lyric: lyricTemplate,
                bible: bibleTemplate,
            },
        });
    });

    async function saveTemplates() {
        // 1. Save to the SQLite database
        await settingsState.setDbSetting("obs_template_lyric", lyricTemplate);
        await settingsState.setDbSetting("obs_template_bible", bibleTemplate);

        // 2. Update the active Svelte state so the OBS WebSocket broadcaster gets it immediately
        settingsState.update({
            obsTemplates: {
                lyric: lyricTemplate,
                bible: bibleTemplate,
            },
        });
        presentation.broadcastState();
    }
</script>

<div class="space-y-6 max-w-4xl">
    <div>
        <h2
            class="text-xl font-bold text-foreground flex items-center gap-2 mb-2"
        >
            <Code2 class="text-violet-500" /> OBS Custom HTML Templates
        </h2>
        <p class="text-sm text-muted-foreground">
            Override the default OBS lower-thirds with your own HTML layout. Use <code
                >{`{{text}}`}</code
            >
            for the main content and <code>{`{{subText}}`}</code> for references/titles.
            Leave blank to use the default design.
        </p>
    </div>

    <!-- Lyrics Template -->
    <div class="space-y-2">
        <label
            for="lyric-template"
            class="text-xs font-bold uppercase tracking-wider text-zinc-400"
        >
            Lyrics HTML
        </label>
        <textarea
            id="lyric-template"
            bind:value={lyricTemplate}
            onblur={saveTemplates}
            placeholder="Add your custom lyrics HTML here"
            class="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-sm text-zinc-300 outline-none focus:border-violet-500 transition-colors"
        ></textarea>
    </div>

    <!-- Bible Template -->
    <div class="space-y-2">
        <label
            for="bible-template"
            class="text-xs font-bold uppercase tracking-wider text-zinc-400"
        >
            Bible HTML
        </label>
        <textarea
            id="bible-template"
            bind:value={bibleTemplate}
            onblur={saveTemplates}
            placeholder="Add your custom bible HTML here"
            class="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-sm text-zinc-300 outline-none focus:border-violet-500 transition-colors"
        ></textarea>
    </div>
</div>
