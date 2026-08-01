// src/lib/state/media.svelte.ts
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { copyFile, mkdir, exists, remove } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { getDB } from "$lib/db";
import { settingsState } from "$lib/state/settings.svelte";

export interface Media {
  id: string;
  filename: string;
  filepath: string;
  asset_url?: string;
  type: string;
}

class MediaState {
  allMedia = $state<Media[]>([]);
  activeMedia = $state<Media | null>(null);

  async initDb() {
    return getDB();
  }

  async loadAll() {
    const db = await this.initDb();
    const results = await db.select<Media[]>(
      "SELECT * FROM media ORDER BY created_at DESC",
    );

    // Convert the raw file paths into secure asset:// URLs for the UI
    this.allMedia = results.map((media) => ({
      ...media,
      asset_url: convertFileSrc(media.filepath),
    }));
  }

  async importMedia() {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "All Media",
          extensions: [
            "mp4",
            "webm",
            "mov",
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif",
          ],
        },
        {
          name: "Videos",
          extensions: ["mp4", "webm", "mov"],
        },
        {
          name: "Images",
          extensions: ["jpg", "jpeg", "png", "webp", "gif"],
        },
      ],
    });

    if (!selected) return; // User canceled

    // Normalize the return object
    const filePath = typeof selected === "string" ? selected : selected.path;

    // Extract the full filename (e.g., "background.mp4")
    const fullFileName = filePath.split(/[/\\]/).pop() || "New Media";

    // Extract just the name without extension for the DB
    const name = fullFileName.replace(/\.[^/.]+$/, "");

    // Get the extension to determine the type
    const extension = fullFileName.split(".").pop()?.toLowerCase() || "";

    // Check if it's a video; if not, assume it's an image based on our filters
    const videoExtensions = ["mp4", "webm", "mov"];
    const mediaType = videoExtensions.includes(extension) ? "video" : "image";

    // Copy to workspace if one is configured
    let finalFilePath = filePath;
    const workspace = settingsState.config.workspacePath;

    if (workspace) {
      try {
        const mediaDirPath = await join(workspace, "media");

        // Ensure the workspace/media directory exists
        const dirExists = await exists(mediaDirPath);
        if (!dirExists) {
          await mkdir(mediaDirPath, { recursive: true });
        }

        // Prevent overwriting files with the exact same name
        let targetFileName = fullFileName;
        finalFilePath = await join(mediaDirPath, targetFileName);

        if (await exists(finalFilePath)) {
          const uniqueId = crypto.randomUUID().split("-")[0];
          targetFileName = `${name}-${uniqueId}.${extension}`;
          finalFilePath = await join(mediaDirPath, targetFileName);
        }

        // Copy the file from the original location to the workspace
        await copyFile(filePath, finalFilePath);
      } catch (err) {
        console.error("Failed to copy media to workspace:", err);
        finalFilePath = filePath;
      }
    }

    const id = crypto.randomUUID();
    const db = await this.initDb();

    await db.execute(
      "INSERT INTO media (id, filename, filepath, type) VALUES ($1, $2, $3, $4)",
      [id, name, finalFilePath, mediaType],
    );

    await this.loadAll();
  }

  async delete(id: string) {
    const db = await this.initDb();

    // 1. Fetch the media record first so we know where the file is stored
    const results = await db.select<Media[]>(
      "SELECT filepath FROM media WHERE id = $1",
      [id],
    );

    // 2. Delete the record from the database
    await db.execute("DELETE FROM media WHERE id = $1", [id]);

    // 3. Safely attempt to delete the physical file from the workspace
    if (results.length > 0) {
      const filepath = results[0].filepath;
      const workspace = settingsState.config.workspacePath;

      if (workspace && filepath.includes(workspace)) {
        try {
          if (await exists(filepath)) {
            await remove(filepath);
          }
        } catch (err) {
          console.error("Failed to delete physical media file:", err);
        }
      }
    }

    // 4. Update local state
    if (this.activeMedia?.id === id) {
      this.activeMedia = null;
    }

    await this.loadAll();
  }

  setActive(media: Media | null) {
    this.activeMedia = media;
  }
}

export const media = new MediaState();
