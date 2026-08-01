<script lang="ts">
    import { page } from "$app/stores";
</script>

<div
    class="flex flex-col items-center justify-center h-full w-full bg-zinc-950 text-center p-8"
>
    <div class="text-red-500 mb-4">
        <svg
            class="w-12 h-12 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
        </svg>
    </div>

    <h1 class="text-2xl font-bold text-zinc-100 mb-2">
        {$page.status}: Route Error
    </h1>

    <p class="text-zinc-400 max-w-md">
        {$page.error?.message ||
            "The requested module or page could not be found."}
    </p>

    <a
        href="/"
        class="mt-6 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors"
    >
        Return to Lyrics
    </a>
</div>
