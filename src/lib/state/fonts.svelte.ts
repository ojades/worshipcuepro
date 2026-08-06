// src/lib/state/fonts.svelte.ts
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  copyFile,
  exists,
  mkdir,
  readDir,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { settingsState } from "./settings.svelte";

export interface CustomFont {
  name: string;
  filename: string;
  family: string;
}

const BUNDLED_FONTS = [
  "BebasNeue-Regular.ttf",
  "Cinzel-VariableFont_wght.ttf",
  "Inter-Variable.ttf",
  "Montserrat-Italic-VariableFont_wght.ttf",
  "Montserrat-VariableFont_wght.ttf",
  "Poppins-Black.ttf",
  "Poppins-BlackItalic.ttf",
  "Poppins-Bold.ttf",
  "Poppins-BoldItalic.ttf",
  "Poppins-ExtraBold.ttf",
  "Poppins-Medium.ttf",
  "Poppins-Regular.ttf",
  "Poppins-SemiBold.ttf",
];

class FontState {
  customFonts = $state<CustomFont[]>([]);
  systemFonts = [
    "sans-serif",
    "serif",
    "monospace",
    "Arial",
    "Inter",
    "Impact",
    "Georgia",
    "Trebuchet MS",
  ];

  // Combined list for dropdowns
  availableFonts = $derived(
    [
      ...this.systemFonts.map((f) => ({ name: f, family: f, isCustom: false })),
      ...this.customFonts.map((f) => ({
        name: f.name,
        family: f.family,
        isCustom: true,
      })),
    ].sort((a, b) => a.name.localeCompare(b.name)),
  );

  /**
   * Checks the workspace and copies bundled fonts if they don't exist yet.
   */
  private async seedDefaultFonts(workspace: string) {
    try {
      const fontsDir = await join(workspace, "fonts");
      if (!(await exists(fontsDir))) {
        await mkdir(fontsDir, { recursive: true });
      }

      for (const fontName of BUNDLED_FONTS) {
        const targetPath = await join(fontsDir, fontName);

        // Only seed if the file isn't already in the workspace
        if (!(await exists(targetPath))) {
          // Fetch the file from SvelteKit's static assets
          const response = await fetch(`/fonts/${fontName}`);

          if (response.ok) {
            // Convert to a Uint8Array and write to the filesystem
            const buffer = await response.arrayBuffer();
            await writeFile(targetPath, new Uint8Array(buffer));
            console.log(`Seeded default font: ${fontName}`);
          } else {
            console.warn(
              `Bundled font not found in static folder: ${fontName}`,
            );
          }
        }
      }
    } catch (e) {
      console.error("Failed to seed default fonts:", e);
    }
  }

  /**
   * Scans {workspace}fonts, loads all font files into browser memory
   */
  async loadFonts() {
    const workspace = settingsState.config.workspacePath;
    if (!workspace) return;

    await this.seedDefaultFonts(workspace);

    try {
      const fontsDir = await join(workspace, "fonts");
      if (!(await exists(fontsDir))) {
        await mkdir(fontsDir, { recursive: true });
        return;
      }

      const files = await readDir(fontsDir);
      const loaded: CustomFont[] = [];

      for (const file of files) {
        if (!file.name) continue;
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (["ttf", "otf", "woff", "woff2"].includes(ext || "")) {
          const fontName = file.name.replace(/\.[^/.]+$/, "");
          const filePath = await join(fontsDir, file.name);
          const assetUrl = convertFileSrc(filePath);

          // Dynamically register font with Web API
          const fontFace = new FontFace(fontName, `url("${assetUrl}")`);
          await fontFace.load();
          document.fonts.add(fontFace);

          loaded.push({
            name: fontName,
            filename: file.name,
            family: fontName,
          });
        }
      }

      this.customFonts = loaded.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.error("Failed to load workspace fonts:", e);
    }
  }

  /**
   * Import a font file from user's machine into workspace
   */
  async importFont() {
    const selected = await open({
      multiple: true, // Allow multiple file selection
      filters: [
        { name: "Font Files", extensions: ["ttf", "otf", "woff", "woff2"] },
      ],
    });

    // Handle cancellation or empty selection
    if (!selected || selected.length === 0) return;

    const workspace = settingsState.config.workspacePath;
    if (!workspace) return;

    const fontsDir = await join(workspace, "fonts");

    // Ensure the fonts directory exists once before the loop
    await mkdir(fontsDir, { recursive: true });

    // Normalize to an array (just in case the API returns a single string fallback)
    const filePaths = Array.isArray(selected) ? selected : [selected];

    // Loop through each selected file and copy it to the workspace
    for (const filePath of filePaths) {
      // Handle potential Tauri v2 object returns, though usually it's a string path here
      const pathStr =
        typeof filePath === "string" ? filePath : (filePath as any).path;
      if (!pathStr) continue;

      const fileName = pathStr.split(/[/\\]/).pop() || "Font";
      const targetPath = await join(fontsDir, fileName);

      try {
        await copyFile(pathStr, targetPath);
      } catch (err) {
        console.error(`Failed to copy font ${fileName}:`, err);
      }
    }

    // Reload fonts across the app once all files are copied
    await this.loadFonts();
  }
}

export const fontState = new FontState();
