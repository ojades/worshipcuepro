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
  filepath: string; // In DB this is relative, in State this resolves to Absolute
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

    const workspace = settingsState.config.workspacePath;
    let mediaDirPath = "";
    if (workspace) {
      mediaDirPath = await join(workspace, "media");
    }

    // Convert the raw/relative file paths into absolute paths and secure asset:// URLs
    const processedMedia = await Promise.all(
      results.map(async (media) => {
        let absolutePath = media.filepath;

        // If it's just a filename (no slashes) and we have a workspace, construct the absolute path
        if (
          workspace &&
          !absolutePath.includes("/") &&
          !absolutePath.includes("\\")
        ) {
          absolutePath = await join(mediaDirPath, media.filepath);
        }

        return {
          ...media,
          filepath: absolutePath, // Expose absolute path in memory for UI components
          asset_url: convertFileSrc(absolutePath),
        };
      }),
    );

    this.allMedia = processedMedia;
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

    // Extract just the name without extension for the DB display name
    const name = fullFileName.replace(/\.[^/.]+$/, "");

    // Get the extension to determine the type
    const extension = fullFileName.split(".").pop()?.toLowerCase() || "";

    // Check if it's a video; if not, assume it's an image based on our filters
    const videoExtensions = ["mp4", "webm", "mov"];
    const mediaType = videoExtensions.includes(extension) ? "video" : "image";

    const workspace = settingsState.config.workspacePath;
    let dbFilePath = filePath; // Default to absolute path if no workspace exists

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
        let finalFilePath = await join(mediaDirPath, targetFileName);

        if (await exists(finalFilePath)) {
          const uniqueId = crypto.randomUUID().split("-")[0];
          targetFileName = `${name}-${uniqueId}.${extension}`;
          finalFilePath = await join(mediaDirPath, targetFileName);
        }

        // Copy the file from the original location to the workspace
        await copyFile(filePath, finalFilePath);

        // Store ONLY the filename in the database for cross-device compatibility
        dbFilePath = targetFileName;
      } catch (err) {
        console.error("Failed to copy media to workspace:", err);
      }
    }

    const id = crypto.randomUUID();
    const db = await this.initDb();

    await db.execute(
      "INSERT INTO media (id, filename, filepath, type) VALUES ($1, $2, $3, $4)",
      [id, name, dbFilePath, mediaType],
    );

    await this.loadAll();
  }

  async delete(id: string) {
    const db = await this.initDb();

    // 1. Fetch the media record first so we know what filename to delete
    const results = await db.select<Media[]>(
      "SELECT filepath FROM media WHERE id = $1",
      [id],
    );

    // 2. Delete the record from the database
    await db.execute("DELETE FROM media WHERE id = $1", [id]);

    // 3. Safely attempt to delete the physical file from the workspace
    if (results.length > 0) {
      let filepath = results[0].filepath;
      const workspace = settingsState.config.workspacePath;

      if (workspace) {
        // Resolve absolute path if only a filename was stored
        if (!filepath.includes("/") && !filepath.includes("\\")) {
          filepath = await join(workspace, "media", filepath);
        }

        if (filepath.includes(workspace)) {
          try {
            if (await exists(filepath)) {
              await remove(filepath);
            }
          } catch (err) {
            console.error("Failed to delete physical media file:", err);
          }
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
