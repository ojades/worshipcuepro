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

  private async safeFetchFont(fontName: string): Promise<ArrayBuffer | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const response = await fetch(`/fonts/${fontName}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      return await response.arrayBuffer();
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn(`[Fonts] Failed to fetch bundled font ${fontName}.`);
      return null;
    }
  }

  private async seedDefaultFonts(workspace: string) {
    try {
      const fontsDir = await join(workspace, "fonts");
      if (!(await exists(fontsDir))) {
        await mkdir(fontsDir, { recursive: true });
      }

      const seedPromises = BUNDLED_FONTS.map(async (fontName) => {
        const targetPath = await join(fontsDir, fontName);
        if (!(await exists(targetPath))) {
          const buffer = await this.safeFetchFont(fontName);
          if (buffer) {
            await writeFile(targetPath, new Uint8Array(buffer));
            console.log(`Seeded default font: ${fontName}`);
          }
        }
      });

      await Promise.all(seedPromises);
    } catch (e) {
      console.error("Failed to seed default fonts:", e);
    }
  }

  async loadFonts() {
    const workspace = settingsState.workspacePath;
    if (!workspace) return;

    try {
      await this.seedDefaultFonts(workspace);
    } catch (e) {
      console.error("Seed error caught in loadFonts:", e);
    }

    try {
      const fontsDir = await join(workspace, "fonts");
      if (!(await exists(fontsDir))) {
        await mkdir(fontsDir, { recursive: true });
        return;
      }

      const files = await readDir(fontsDir);
      const loaded: CustomFont[] = [];
      let cssRules = "";

      // FIX: Instantly generate CSS instead of blocking JS memory
      for (const file of files) {
        if (!file.name) continue;
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (["ttf", "otf", "woff", "woff2"].includes(ext || "")) {
          const fontName = file.name.replace(/\.[^/.]+$/, "");
          const filePath = await join(fontsDir, file.name);
          const assetUrl = convertFileSrc(filePath);

          cssRules += `
            @font-face {
              font-family: "${fontName}";
              src: url("${assetUrl}");
              font-display: swap;
            }
          `;

          loaded.push({
            name: fontName,
            filename: file.name,
            family: fontName,
          });
        }
      }

      // Inject the CSS directly into the document <head>
      let styleEl = document.getElementById("wcp-custom-fonts");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "wcp-custom-fonts";
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = cssRules;

      this.customFonts = loaded.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.error("Failed to load workspace fonts:", e);
    }
  }

  async importFont() {
    const selected = await open({
      multiple: true,
      filters: [
        { name: "Font Files", extensions: ["ttf", "otf", "woff", "woff2"] },
      ],
    });

    if (!selected || selected.length === 0) return;

    const workspace = settingsState.workspacePath;
    if (!workspace) return;

    const fontsDir = await join(workspace, "fonts");
    await mkdir(fontsDir, { recursive: true });

    const filePaths = Array.isArray(selected) ? selected : [selected];

    for (const filePath of filePaths) {
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

    await this.loadFonts();
  }
}

export const fontState = new FontState();
