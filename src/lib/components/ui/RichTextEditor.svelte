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
        Heading1,
        Heading2,
        Heading3,
        Type,
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
        class="w-full max-w-5xl tiptap-canvas font-bold leading-snug drop-shadow-lg"
        bind:this={element}
    ></div>
</div>

<!-- Bubble Menu UI -->
<div
    bind:this={bubbleMenuEl}
    class="flex items-center gap-1 bg-zinc-900 border border-zinc-700 p-1.5 rounded-lg shadow-2xl transition-all"
    style="visibility: hidden;"
>
    {#if editor}
        <!-- Size Controls (Headings) -->
        <div class="flex items-center bg-zinc-950/50 rounded p-0.5">
            <button
                onclick={() =>
                    editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                class="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                    'heading',
                    { level: 1 },
                )
                    ? 'bg-zinc-800 text-white'
                    : ''}"
                title="Extra Large (H1)"
            >
                <Heading1 size={16} />
            </button>
            <button
                onclick={() =>
                    editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                class="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                    'heading',
                    { level: 2 },
                )
                    ? 'bg-zinc-800 text-white'
                    : ''}"
                title="Large (H2)"
            >
                <Heading2 size={16} />
            </button>
            <button
                onclick={() =>
                    editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                class="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                    'heading',
                    { level: 3 },
                )
                    ? 'bg-zinc-800 text-white'
                    : ''}"
                title="Medium (H3)"
            >
                <Heading3 size={16} />
            </button>
            <button
                onclick={() => editor?.chain().focus().setParagraph().run()}
                class="p-1 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                    'paragraph',
                )
                    ? 'bg-zinc-800 text-white'
                    : ''}"
                title="Normal Text"
            >
                <Type size={16} />
            </button>
        </div>

        <div class="w-px h-5 bg-zinc-700 mx-1"></div>

        <!-- Formatting -->
        <button
            onclick={() => editor?.chain().focus().toggleBold().run()}
            class="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                'bold',
            )
                ? 'bg-zinc-800 text-white'
                : ''}"
            title="Bold"
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
            title="Italic"
        >
            <Italic size={16} />
        </button>

        <div class="w-px h-5 bg-zinc-700 mx-1"></div>

        <!-- Alignment -->
        <button
            onclick={() => editor?.chain().focus().setTextAlign("left").run()}
            class="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 transition-colors {editor.isActive(
                { textAlign: 'left' },
            )
                ? 'bg-zinc-800 text-white'
                : ''}"
            title="Align Left"
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
            title="Align Center"
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
            title="Align Right"
        >
            <AlignRight size={16} />
        </button>

        <div class="w-px h-5 bg-zinc-700 mx-1"></div>

        <!-- Colors -->
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
    /*
      CRITICAL: We must explicitly style the inner elements
      because Tailwind's base reset strips styles from standard tags like <em> and <h1>
    */
    :global(.tiptap-canvas) {
        font-size: 4cqw; /* Base size */
    }

    :global(.tiptap-canvas p) {
        margin: 0;
        white-space: pre-wrap;
    }

    /* Emphasize Italic explicitly */
    :global(.tiptap-canvas em) {
        font-style: italic !important;
    }

    /* Size Scales using Headings */
    :global(.tiptap-canvas h1) {
        font-size: 1.8em;
        line-height: 1.1;
        margin: 0;
        white-space: pre-wrap;
    }
    :global(.tiptap-canvas h2) {
        font-size: 1.4em;
        line-height: 1.2;
        margin: 0;
        white-space: pre-wrap;
    }
    :global(.tiptap-canvas h3) {
        font-size: 1.2em;
        line-height: 1.2;
        margin: 0;
        white-space: pre-wrap;
    }
</style>
