<!-- src/lib/components/layout/shoot/CanvasEditor.svelte -->
<script lang="ts">
    import RichTextEditor from "$lib/components/ui/RichTextEditor.svelte";

    let { slide, onUpdate } = $props<{
        slide: {
            id: string;
            media_type?: string | null;
            asset_url?: string | null;
            text_content: string;
        };
        onUpdate: (html: string) => void;
    }>();
</script>

<div
    class="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative border border-zinc-800 animate-in fade-in zoom-in-95"
    style="container-type: size;"
>
    <!-- Background Layer -->
    {#if slide.media_type === "video" && slide.asset_url}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
            src={slide.asset_url}
            class="absolute inset-0 w-full h-full object-cover opacity-60"
            autoplay
            loop
            muted
        ></video>
    {:else if slide.asset_url}
        <img
            src={slide.asset_url}
            alt="slide background"
            class="absolute inset-0 w-full h-full object-cover opacity-60"
        />
    {/if}

    <!-- Tiptap Editor Layer -->
    <div class="absolute inset-0 z-10 flex flex-col">
        <RichTextEditor content={slide.text_content} {onUpdate} />
    </div>
</div>
