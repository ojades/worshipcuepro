<!-- src/lib/components/ui/RichTextEditor.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { Editor } from "@tiptap/core";
    import StarterKit from "@tiptap/starter-kit";
    import TextAlign from "@tiptap/extension-text-align";

    import Color from "@tiptap/extension-color";
    import { BubbleMenu } from "@tiptap/extension-bubble-menu";
    import {
        Bold,
        Italic,
        AlignLeft,
        AlignCenter,
        AlignRight,
        Palette,
    } from "@lucide/svelte";
    import { TextStyle } from "@tiptap/extension-text-style";

    let { content = "", onUpdate } = $props<{
        content?: string;
        onUpdate: (html: string) => void;
    }>();

    let element: HTMLElement;
    let bubbleMenuEl: HTMLElement;
    let editor: Editor | null = $state(null);

    const colors = [
        "#FFFFFF",
        "#F97316",
        "#06B6D4",
        "#8B5CF6",
        "#EAB308",
        "#EF4444",
    ];

    onMount(() => {
        editor = new Editor({
            element,
            extensions: [
                StarterKit,
                TextAlign.configure({ types: ["heading", "paragraph"] }),
                TextStyle,
                Color,
                BubbleMenu.configure({
                    element: bubbleMenuEl,
                }),
            ],
            content,
            onUpdate: ({ editor }) => {
                onUpdate(editor.getHTML());
            },
            editorProps: {
                attributes: {
                    // Gives the editor space to type and removes the default browser outline
                    class: "outline-none min-h-full w-full flex flex-col justify-center text-white",
                },
            },
        });
    });

    onDestroy(() => {
        if (editor) editor.destroy();
    });
</script>

<div class="w-full h-full flex items-center justify-center p-8">
    <div
        class="w-full max-w-5xl tiptap-canvas text-[4cqw] font-bold leading-snug drop-shadow-lg"
        bind:this={element}
    ></div>
</div>

<!-- Bubble Menu UI (Hidden by default, triggered by highlight) -->
<div
    bind:this={bubbleMenuEl}
    class="flex items-center gap-1 bg-zinc-900 border border-zinc-700 p-1.5 rounded-lg shadow-2xl transition-all"
    style="visibility: hidden;"
>
    {#if editor}
        <button
            onclick={() => editor?.chain().focus().toggleBold().run()}
            class="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                'bold',
            )
                ? 'bg-zinc-800 text-white'
                : ''}"
        >
            <Bold size={16} />
        </button>
        <button
            onclick={() => editor?.chain().focus().toggleItalic().run()}
            class="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                'italic',
            )
                ? 'bg-zinc-800 text-white'
                : ''}"
        >
            <Italic size={16} />
        </button>

        <div class="w-px h-5 bg-zinc-700 mx-1"></div>

        <button
            onclick={() => editor?.chain().focus().setTextAlign("left").run()}
            class="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                { textAlign: 'left' },
            )
                ? 'bg-zinc-800 text-white'
                : ''}"
        >
            <AlignLeft size={16} />
        </button>
        <button
            onclick={() => editor?.chain().focus().setTextAlign("center").run()}
            class="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                { textAlign: 'center' },
            )
                ? 'bg-zinc-800 text-white'
                : ''}"
        >
            <AlignCenter size={16} />
        </button>
        <button
            onclick={() => editor?.chain().focus().setTextAlign("right").run()}
            class="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                { textAlign: 'right' },
            )
                ? 'bg-zinc-800 text-white'
                : ''}"
        >
            <AlignRight size={16} />
        </button>

        <div class="w-px h-5 bg-zinc-700 mx-1"></div>

        <div class="flex items-center gap-1 px-1">
            {#each colors as color}
                <button
                    aria-label="color"
                    onclick={() =>
                        editor?.chain().focus().setColor(color).run()}
                    class="w-5 h-5 rounded-full border border-zinc-700 hover:scale-110 transition-transform {editor.isActive(
                        'textStyle',
                        { color },
                    )
                        ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900'
                        : ''}"
                    style="background-color: {color};"
                ></button>
            {/each}
        </div>
    {/if}
</div>

<style>
    /* Force the tiptap paragraph to inherit our container styling */
    :global(.tiptap-canvas p) {
        margin: 0;
        white-space: pre-wrap;
    }
</style>
