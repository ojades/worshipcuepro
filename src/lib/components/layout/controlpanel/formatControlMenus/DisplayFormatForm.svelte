<!-- src/lib/components/layout/controlpanel/formatControlMenus/DisplayFormatForm.svelte -->
<script lang="ts">
    import { settingsState } from "$lib/state/settings.svelte";
    import { fontState } from "$lib/state/fonts.svelte";
    import {
        AlignLeft,
        AlignCenter,
        AlignRight,
        AlignVerticalJustifyStart,
        AlignVerticalJustifyCenter,
        AlignVerticalJustifyEnd,
    } from "@lucide/svelte";
    import type { DisplayConfig, TextFormatConfig } from "$lib/types/models";

    let { target }: { target: "projector" | "stage" } = $props();

    // Derived configurations for the active target
    let displayConfig = $derived(settingsState.config[target]);
    let formatConfig: TextFormatConfig | null = $derived(
        displayConfig?.textFormat || null,
    );

    function updateFormat(key: keyof TextFormatConfig, value: any) {
        settingsState.update({
            [target]: {
                ...displayConfig,
                textFormat: { ...formatConfig, [key]: value },
            },
        });
    }

    function updateDisplay(key: keyof DisplayConfig, value: any) {
        settingsState.update({
            [target]: {
                ...displayConfig,
                [key]: value,
            },
        });
    }
</script>

<div class="space-y-4 px-4 py-3">
    <!-- Row 1: Font Family -->
    <div class="space-y-1.5">
        <label
            for="font-family"
            class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
        >
            Font Family
        </label>
        <select
            id="font-family"
            value={formatConfig?.fontFamily || fontState.availableFonts[0]}
            onchange={(e) => updateFormat("fontFamily", e.currentTarget.value)}
            class="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-neon-violet transition-colors cursor-pointer"
        >
            {#each fontState.availableFonts as font}
                <option value={font.family}>
                    {font.name}
                    {font.isCustom ? "(Custom)" : ""}
                </option>
            {/each}
        </select>
    </div>

    <!-- Row 2: Font Weight & Text Scale (Side-by-side to save space) -->
    <div class="flex gap-4">
        <!-- Font Weight -->
        <div class="flex-1 space-y-1.5">
            <label
                for="font-weight"
                class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            >
                Font Weight
            </label>
            <select
                id="font-weight"
                value={formatConfig?.fontWeight || "bold"}
                onchange={(e) =>
                    updateFormat("fontWeight", e.currentTarget.value)}
                class="w-full bg-zinc-900 border border-border rounded-md px-2 py-1.5 text-xs text-foreground outline-none focus:border-neon-violet transition-colors cursor-pointer"
            >
                <option value="normal">Regular</option>
                <option value="medium">Medium</option>
                <option value="semibold">Semi Bold</option>
                <option value="bold">Bold</option>
                <option value="800">Black</option>
            </select>
        </div>

        <!-- Font Scale -->
        <div class="flex-1 space-y-1.5">
            <div class="flex justify-between items-center h-[14px]">
                <label
                    for="font-scale"
                    class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                    Font Scale
                </label>
                <span
                    id="font-scale"
                    class="text-[10px] font-mono {target === 'projector'
                        ? 'text-neon-violet'
                        : 'text-neon-cyan'}"
                >
                    {Math.round((displayConfig?.textScale ?? 1) * 100)}%
                </span>
            </div>
            <div class="flex items-center h-[26px]">
                <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={displayConfig?.textScale ?? 1}
                    oninput={(e) =>
                        updateDisplay(
                            "textScale",
                            parseFloat(e.currentTarget.value),
                        )}
                    class="w-full {target === 'projector'
                        ? 'accent-neon-violet'
                        : 'accent-neon-cyan'}"
                />
            </div>
        </div>
    </div>

    <!-- Row 3: Alignment (Horizontal & Vertical) -->
    <div class="flex gap-4">
        <!-- Horizontal -->
        <div class="flex-1 space-y-1.5">
            <label
                for="text-align"
                class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            >
                Align
            </label>
            <div
                id="text-align"
                class="flex bg-zinc-900 rounded-md border border-border p-0.5"
            >
                {#each [{ icon: AlignLeft, value: "left" }, { icon: AlignCenter, value: "center" }, { icon: AlignRight, value: "right" }] as align}
                    <button
                        onclick={() => updateFormat("textAlign", align.value)}
                        class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {formatConfig?.textAlign ===
                        align.value
                            ? 'bg-zinc-800 text-foreground'
                            : 'text-zinc-500 hover:text-zinc-300'}"
                    >
                        <align.icon size={14} />
                    </button>
                {/each}
            </div>
        </div>

        <!-- Vertical -->
        <div class="flex-1 space-y-1.5">
            <label
                for="valign"
                class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            >
                Vertical
            </label>
            <div
                id="valign"
                class="flex bg-zinc-900 rounded-md border border-border p-0.5"
            >
                <button
                    class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {displayConfig?.textVAlign ===
                    'top'
                        ? 'bg-zinc-800 text-foreground'
                        : 'text-zinc-500 hover:text-zinc-300'}"
                    onclick={() => updateDisplay("textVAlign", "top")}
                    title="Top Align"
                    ><AlignVerticalJustifyStart size={14} /></button
                >
                <button
                    class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {displayConfig?.textVAlign ===
                    'middle'
                        ? 'bg-zinc-800 text-foreground'
                        : 'text-zinc-500 hover:text-zinc-300'}"
                    onclick={() => updateDisplay("textVAlign", "middle")}
                    title="Middle Align"
                    ><AlignVerticalJustifyCenter size={14} /></button
                >
                <button
                    class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {displayConfig?.textVAlign ===
                    'bottom'
                        ? 'bg-zinc-800 text-foreground'
                        : 'text-zinc-500 hover:text-zinc-300'}"
                    onclick={() => updateDisplay("textVAlign", "bottom")}
                    title="Bottom Align"
                    ><AlignVerticalJustifyEnd size={14} /></button
                >
            </div>
        </div>
    </div>

    <!-- Row 4: Capitalization -->
    <div class="space-y-1.5">
        <label
            for="capitalization"
            class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
        >
            Capitalization
        </label>
        <div
            id="capitalization"
            class="grid grid-cols-4 gap-1 bg-zinc-900 p-0.5 rounded-md border border-border"
        >
            {#each [{ label: "AA", value: "uppercase", title: "UPPERCASE" }, { label: "Aa", value: "capitalize", title: "Capitalize Words" }, { label: "aa", value: "lowercase", title: "lowercase" }, { label: "As-is", value: "none", title: "Original Text" }] as mode}
                <button
                    onclick={() => updateFormat("textTransform", mode.value)}
                    class="py-1 text-xs font-semibold rounded-sm transition-colors {formatConfig?.textTransform ===
                    mode.value
                        ? target === 'projector'
                            ? 'bg-neon-violet/20 text-neon-violet'
                            : 'bg-neon-cyan/20 text-neon-cyan'
                        : 'text-zinc-500 hover:text-zinc-300'}"
                    title={mode.title}
                >
                    {mode.label}
                </button>
            {/each}
        </div>
    </div>

    <!-- Row 5: Stroke / Outline -->
    <div class="space-y-1.5">
        <div
            class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
        >
            <span>Text Outline</span>
            <span>{formatConfig?.textStrokeWidth}px</span>
        </div>
        <div class="flex items-center gap-3">
            <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={formatConfig?.textStrokeWidth}
                oninput={(e) =>
                    updateFormat(
                        "textStrokeWidth",
                        parseInt(e.currentTarget.value),
                    )}
                class="flex-1 {target === 'projector'
                    ? 'accent-neon-violet'
                    : 'accent-neon-cyan'}"
            />
            <input
                type="color"
                value={formatConfig?.textStrokeColor}
                oninput={(e) =>
                    updateFormat("textStrokeColor", e.currentTarget.value)}
                class="w-6 h-6 rounded border border-zinc-700 bg-transparent cursor-pointer"
            />
        </div>
    </div>
</div>
