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

<div class="space-y-6 px-4 py-4">
    <!-- ================= MAIN TEXT STYLING ================= -->
    <div class="space-y-4">
        <h4
            class="text-neon-cyan text-[10px] font-bold tracking-widest uppercase border-b border-zinc-800 pb-1"
        >
            Main Text
        </h4>

        <!-- Row 1: Font Family -->
        <div class="space-y-1.5">
            <label
                for="font-family-select"
                class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >Font Family</label
            >
            <select
                id="font-family-select"
                value={formatConfig?.fontFamily ||
                    fontState.availableFonts[0]?.family}
                onchange={(e) =>
                    updateFormat("fontFamily", e.currentTarget.value)}
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

        <!-- Row 2: Font Weight & Text Scale -->
        <div class="flex gap-4">
            <div class="flex-1 space-y-1.5">
                <label
                    for="font-weight-select"
                    class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >Weight</label
                >
                <select
                    id="font-weight-select"
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

            <div class="flex-1 space-y-1.5">
                <div class="flex justify-between items-center h-[14px]">
                    <label
                        for="scale-slider"
                        class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                        >Scale</label
                    >
                    <span
                        id="scale-slider-value"
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

        <!-- Row 3: Vertical Align & Vertical Gap -->
        <div class="flex gap-4">
            <div class="flex-[1.5] space-y-1.5">
                <label
                    for="vertical-align-select"
                    class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >Vertical Align</label
                >
                <div
                    id="vertical-align-select"
                    class="flex bg-zinc-900 rounded-md border border-border p-0.5"
                >
                    <button
                        class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {displayConfig?.textVAlign ===
                        'top'
                            ? 'bg-zinc-800 text-foreground'
                            : 'text-zinc-500 hover:text-zinc-300'}"
                        onclick={() => updateDisplay("textVAlign", "top")}
                        title="Top"
                        ><AlignVerticalJustifyStart size={14} /></button
                    >
                    <button
                        class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {displayConfig?.textVAlign ===
                        'middle'
                            ? 'bg-zinc-800 text-foreground'
                            : 'text-zinc-500 hover:text-zinc-300'}"
                        onclick={() => updateDisplay("textVAlign", "middle")}
                        title="Middle"
                        ><AlignVerticalJustifyCenter size={14} /></button
                    >
                    <button
                        class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {displayConfig?.textVAlign ===
                        'bottom'
                            ? 'bg-zinc-800 text-foreground'
                            : 'text-zinc-500 hover:text-zinc-300'}"
                        onclick={() => updateDisplay("textVAlign", "bottom")}
                        title="Bottom"
                        ><AlignVerticalJustifyEnd size={14} /></button
                    >
                </div>
            </div>

            <div
                class="flex-1 space-y-1.5 transition-opacity {displayConfig?.textVAlign ===
                'middle'
                    ? 'opacity-30 pointer-events-none'
                    : ''}"
            >
                <div class="flex justify-between items-center h-[14px]">
                    <label
                        for="v-gap-slider"
                        class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                        >Top/Btm Gap</label
                    >
                    <span
                        id="v-gap-slider-value"
                        class="text-[10px] font-mono {target === 'projector'
                            ? 'text-neon-violet'
                            : 'text-neon-cyan'}"
                        >{displayConfig?.vGap ?? 0}</span
                    >
                </div>
                <div class="flex items-center h-[26px]">
                    <input
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={displayConfig?.vGap ?? 0}
                        oninput={(e) =>
                            updateDisplay(
                                "vGap",
                                parseInt(e.currentTarget.value),
                            )}
                        class="w-full {target === 'projector'
                            ? 'accent-neon-violet'
                            : 'accent-neon-cyan'}"
                    />
                </div>
            </div>
        </div>

        <!-- Row 4: Horizontal Align & Capitalization -->
        <div class="flex gap-4">
            <div class="flex-1 space-y-1.5">
                <label
                    for="horizontal-align-select"
                    class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >Horizontal</label
                >
                <div
                    id="horizontal-align-select"
                    class="flex bg-zinc-900 rounded-md border border-border p-0.5"
                >
                    {#each [{ icon: AlignLeft, value: "left" }, { icon: AlignCenter, value: "center" }, { icon: AlignRight, value: "right" }] as align}
                        <button
                            onclick={() =>
                                updateFormat("textAlign", align.value)}
                            class="flex-1 py-1.5 flex justify-center rounded-sm transition-colors {formatConfig?.textAlign ===
                            align.value
                                ? 'bg-zinc-800 text-foreground'
                                : 'text-zinc-500 hover:text-zinc-300'}"
                            ><align.icon size={14} /></button
                        >
                    {/each}
                </div>
            </div>

            <div class="flex-[1.5] space-y-1.5">
                <label
                    for="capitalize-select"
                    class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >Capitalize</label
                >
                <div
                    id="capitalize-select"
                    class="flex bg-zinc-900 p-0.5 rounded-md border border-border"
                >
                    {#each [{ label: "AA", value: "uppercase" }, { label: "Aa", value: "capitalize" }, { label: "aa", value: "lowercase" }, { label: "As-is", value: "none" }] as mode}
                        <button
                            onclick={() =>
                                updateFormat("textTransform", mode.value)}
                            class="flex-1 py-1 text-xs font-semibold rounded-sm transition-colors {formatConfig?.textTransform ===
                            mode.value
                                ? target === 'projector'
                                    ? 'bg-neon-violet/20 text-neon-violet'
                                    : 'bg-neon-cyan/20 text-neon-cyan'
                                : 'text-zinc-500 hover:text-zinc-300'}"
                            >{mode.label}</button
                        >
                    {/each}
                </div>
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

    <!-- ================= REFERENCE TEXT STYLING ================= -->
    <div class="space-y-4 pt-4 border-t border-zinc-800/50">
        <h4
            class="text-neon-cyan text-[10px] font-bold tracking-widest uppercase border-b border-zinc-800 pb-1"
        >
            Reference Subtitles
        </h4>

        <!-- Ref Position (Only for Projector) -->
        {#if target === "projector"}
            <div class="space-y-1.5 mb-2">
                <label
                    class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >Location on Screen</label
                >
                <select
                    value={displayConfig?.referencePosition || "bottom-right"}
                    onchange={(e) =>
                        updateDisplay(
                            "referencePosition",
                            e.currentTarget.value,
                        )}
                    class="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-neon-violet transition-colors cursor-pointer"
                >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-center">Bottom Center</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                    <option value="top-center">Top Center</option>
                </select>
            </div>
        {/if}

        <!-- Ref Font Family -->
        <div class="space-y-1.5">
            <label
                for="font-family-select"
                class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >Font Family</label
            >
            <select
                id="font-family-select"
                value={formatConfig?.referenceFontFamily ||
                    fontState.availableFonts[0]?.family}
                onchange={(e) =>
                    updateFormat("referenceFontFamily", e.currentTarget.value)}
                class="w-full bg-zinc-900 border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-neon-violet transition-colors cursor-pointer"
            >
                {#each fontState.availableFonts as font}
                    <option value={font.family}
                        >{font.name} {font.isCustom ? "(Custom)" : ""}</option
                    >
                {/each}
            </select>
        </div>

        <div class="flex gap-4">
            <!-- Ref Weight -->
            <div class="flex-1 space-y-1.5">
                <label
                    class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >Weight</label
                >
                <select
                    value={formatConfig?.referenceFontWeight || "bold"}
                    onchange={(e) =>
                        updateFormat(
                            "referenceFontWeight",
                            e.currentTarget.value,
                        )}
                    class="w-full bg-zinc-900 border border-border rounded-md px-2 py-1.5 text-xs text-foreground outline-none focus:border-neon-violet transition-colors cursor-pointer"
                >
                    <option value="normal">Regular</option>
                    <option value="medium">Medium</option>
                    <option value="semibold">Semi Bold</option>
                    <option value="bold">Bold</option>
                    <option value="800">Black</option>
                </select>
            </div>
            <!-- Ref Capitalization -->
            <div class="flex-1 space-y-1.5">
                <label
                    for="capitalize-select"
                    class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >Caps</label
                >
                <select
                    id="capitalize-select"
                    value={formatConfig?.referenceTextTransform || "uppercase"}
                    onchange={(e) =>
                        updateFormat(
                            "referenceTextTransform",
                            e.currentTarget.value,
                        )}
                    class="w-full bg-zinc-900 border border-border rounded-md px-2 py-1.5 text-xs text-foreground outline-none focus:border-neon-violet transition-colors cursor-pointer"
                >
                    <option value="uppercase">UPPER</option>
                    <option value="capitalize">Capitalize</option>
                    <option value="lowercase">lower</option>
                    <option value="none">As-is</option>
                </select>
            </div>
        </div>

        <!-- Ref Scale -->
        <div class="space-y-1.5">
            <div class="flex justify-between items-center h-[14px]">
                <label
                    for="ref-font-scale"
                    class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    >Scale relative to Main Text</label
                >
                <span
                    id="ref-font-scale"
                    class="text-[10px] font-mono {target === 'projector'
                        ? 'text-neon-violet'
                        : 'text-neon-cyan'}"
                >
                    {Math.round(
                        (formatConfig?.referenceFontSizeScale ?? 1.0) * 100,
                    )}%
                </span>
            </div>
            <div class="flex items-center h-[26px]">
                <input
                    type="range"
                    min="0.3"
                    max="2.0"
                    step="0.1"
                    value={formatConfig?.referenceFontSizeScale ?? 1.0}
                    oninput={(e) =>
                        updateFormat(
                            "referenceFontSizeScale",
                            parseFloat(e.currentTarget.value),
                        )}
                    class="w-full {target === 'projector'
                        ? 'accent-neon-violet'
                        : 'accent-neon-cyan'}"
                />
            </div>
        </div>
    </div>
</div>
