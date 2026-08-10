// src/lib/state/media.svelte.ts
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { mkdir, exists, remove, writeFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { getDB } from "$lib/db";
import { settingsState } from "$lib/state/settings.svelte";

export interface Media {
  id: string;
  filename: string;
  filepath: string;
  asset_url?: string;
  type: string;
  category: string;
  thumbnail_path?: string | null;
  thumbnail_url?: string;
}

export const DEFAULT_CATEGORIES = [
  "Uncategorized",
  "Worship",
  "Sermon",
  "Announcements",
  "Countdowns",
  "Logos",
];

// Helper to convert Base64 Data URL to raw bytes for saving to disk
function base64ToUint8Array(base64DataUrl: string) {
  const base64 = base64DataUrl.split(",")[1];
  const raw = atob(base64);
  const array = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

class MediaState {
  allMedia = $state<Media[]>([]);
  activeMedia = $state<Media | null>(null);
  isImporting = $state(false);
  private _isProcessingThumbs = false;

  // --- NEW: Persistent Custom Categories ---
  savedCategories = $state<string[]>([]);

  categories = $derived.by(() => {
    const usedCategories = this.allMedia.map((m) => m.category).filter(Boolean);
    return Array.from(
      new Set(["Uncategorized", ...this.savedCategories, ...usedCategories]),
    ).sort();
  });

  async initDb() {
    return getDB();
  }

  async loadCategories() {
    const stored = await settingsState.getDbSetting("media_categories", "");
    if (stored) {
      this.savedCategories = JSON.parse(stored);
    } else {
      this.savedCategories = [...DEFAULT_CATEGORIES];
      await this.saveCategories();
    }
  }

  async saveCategories() {
    await settingsState.setDbSetting(
      "media_categories",
      JSON.stringify(this.savedCategories),
    );
  }

  async addCategory(name: string) {
    const trimmed = name.trim();
    if (trimmed && !this.savedCategories.includes(trimmed)) {
      this.savedCategories.push(trimmed);
      await this.saveCategories();
    }
  }

  async renameCategory(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || oldName === "Uncategorized" || oldName === trimmed) return;

    // Update the categories list
    const index = this.savedCategories.indexOf(oldName);
    if (index !== -1) {
      this.savedCategories[index] = trimmed;
    } else if (!this.savedCategories.includes(trimmed)) {
      this.savedCategories.push(trimmed);
    }
    await this.saveCategories();

    // Update all media items attached to the old name
    const db = await this.initDb();
    await db.execute("UPDATE media SET category = $1 WHERE category = $2", [
      trimmed,
      oldName,
    ]);
    await this.loadAll();
  }

  async deleteCategory(
    name: string,
    fallbackCategory: string = "Uncategorized",
  ) {
    if (name === "Uncategorized") return; // Protect default

    this.savedCategories = this.savedCategories.filter((c) => c !== name);
    await this.saveCategories();

    const db = await this.initDb();
    await db.execute("UPDATE media SET category = $1 WHERE category = $2", [
      fallbackCategory,
      name,
    ]);
    await this.loadAll();
  }

  async loadAll() {
    if (this.savedCategories.length === 0) {
      await this.loadCategories();
    }

    const db = await this.initDb();
    const results = await db.select<Media[]>(
      "SELECT * FROM media ORDER BY created_at DESC",
    );

    const workspace = settingsState.config.workspacePath;
    let mediaDirPath = workspace ? await join(workspace, "media") : "";
    let thumbDirPath = workspace ? await join(mediaDirPath, "thumbnails") : "";

    const processedMedia = await Promise.all(
      results.map(async (media) => {
        let absolutePath = media.filepath;
        let absoluteThumbPath = media.thumbnail_path;

        if (workspace) {
          if (!absolutePath.includes("/") && !absolutePath.includes("\\")) {
            absolutePath = await join(mediaDirPath, media.filepath);
          }
          if (
            absoluteThumbPath &&
            !absoluteThumbPath.includes("/") &&
            !absoluteThumbPath.includes("\\")
          ) {
            absoluteThumbPath = await join(thumbDirPath, absoluteThumbPath);
          }
        }

        return {
          ...media,
          category: media.category || "Uncategorized",
          filepath: absolutePath,
          asset_url: convertFileSrc(absolutePath),
          thumbnail_url: absoluteThumbPath
            ? convertFileSrc(absoluteThumbPath)
            : undefined,
        };
      }),
    );

    this.allMedia = processedMedia;
    this.processMissingThumbnails();
  }

  // --- BACKGROUND THUMBNAIL WORKER ---
  private async processMissingThumbnails() {
    if (this._isProcessingThumbs) return;
    this._isProcessingThumbs = true;

    try {
      const workspace = settingsState.config.workspacePath;
      if (!workspace) return;

      const mediaDirPath = await join(workspace, "media");
      const thumbsDirPath = await join(mediaDirPath, "thumbnails");

      if (!(await exists(thumbsDirPath))) {
        await mkdir(thumbsDirPath, { recursive: true });
      }

      const missingThumbs = this.allMedia.filter(
        (m) => m.type === "video" && !m.thumbnail_path,
      );

      for (const mediaItem of missingThumbs) {
        if (!mediaItem.asset_url) continue;

        try {
          const base64Data = await this.generateVideoThumbnail(
            mediaItem.asset_url,
          );
          const bytes = base64ToUint8Array(base64Data);

          const thumbFileName = `${mediaItem.id}_thumb.jpg`;
          const absoluteThumbPath = await join(thumbsDirPath, thumbFileName);
          await writeFile(absoluteThumbPath, bytes);

          const db = await this.initDb();
          await db.execute(
            "UPDATE media SET thumbnail_path = $1 WHERE id = $2",
            [thumbFileName, mediaItem.id],
          );

          const index = this.allMedia.findIndex((m) => m.id === mediaItem.id);
          if (index !== -1) {
            this.allMedia[index].thumbnail_path = thumbFileName;
            this.allMedia[index].thumbnail_url =
              convertFileSrc(absoluteThumbPath);
          }
        } catch (e) {
          console.error(`Skipped thumbnail for ${mediaItem.filename}`, e);
        }
      }
    } finally {
      this._isProcessingThumbs = false;
    }
  }

  private async generateVideoThumbnail(videoUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.style.display = "none";
      video.muted = true;
      video.crossOrigin = "anonymous";
      video.src = videoUrl;

      video.load();
      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, video.duration || 0.5);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1.0, 640 / video.videoWidth);
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            resolve(dataUrl);
          } else {
            reject("No canvas context");
          }
        } catch (e) {
          reject(e);
        } finally {
          video.remove();
        }
      };

      video.onerror = (e) => reject(e);
    });
  }

  // --- IMPORT MEDIA ---
  async importMedia(targetCategory: string = "Uncategorized") {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "Media",
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
      ],
    });

    if (!selected) return;
    const files = Array.isArray(selected) ? selected : [selected];
    if (files.length === 0) return;

    this.isImporting = true;
    const db = await this.initDb();
    const workspace = settingsState.config.workspacePath;
    let mediaDirPath = "";

    if (workspace) {
      mediaDirPath = await join(workspace, "media");
      if (!(await exists(mediaDirPath)))
        await mkdir(mediaDirPath, { recursive: true });
    }

    const fileCopyJobs: [string, string][] = [];
    const dbValues: any[][] = [];
    let placeholders: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = typeof file === "string" ? file : file.path;
      const fullFileName = filePath.split(/[/\\]/).pop() || "New Media";
      const name = fullFileName.replace(/\.[^/.]+$/, "");
      const extension = fullFileName.split(".").pop()?.toLowerCase() || "";
      const mediaType = ["mp4", "webm", "mov"].includes(extension)
        ? "video"
        : "image";

      let dbFilePath = filePath;

      if (workspace) {
        let targetFileName = fullFileName;
        let finalFilePath = await join(mediaDirPath, targetFileName);

        if (await exists(finalFilePath)) {
          const uniqueId = crypto.randomUUID().split("-")[0];
          targetFileName = `${name}-${uniqueId}.${extension}`;
          finalFilePath = await join(mediaDirPath, targetFileName);
        }

        fileCopyJobs.push([filePath, finalFilePath]);
        dbFilePath = targetFileName;
      }

      const id = crypto.randomUUID();
      dbValues.push([id, name, dbFilePath, mediaType, targetCategory]);
      placeholders.push(
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`,
      );
    }

    if (fileCopyJobs.length > 0) {
      try {
        await invoke("bulk_copy_media", { files: fileCopyJobs });
      } catch (err) {
        console.error("Bulk copy failed:", err);
      }
    }

    if (dbValues.length > 0) {
      const query = `INSERT INTO media (id, filename, filepath, type, category) VALUES ${placeholders.join(", ")}`;
      await db.execute(query, dbValues.flat());
    }

    await this.loadAll();
    this.isImporting = false;
  }

  async updateCategories(ids: string[], newCategory: string) {
    if (ids.length === 0) return;
    const db = await this.initDb();
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
    await db.execute(
      `UPDATE media SET category = $1 WHERE id IN (${placeholders})`,
      [newCategory, ...ids],
    );
    await this.loadAll();
  }

  async bulkDelete(ids: string[]) {
    if (ids.length === 0) return;
    const db = await this.initDb();

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    const results = await db.select<Media[]>(
      `SELECT filepath, thumbnail_path FROM media WHERE id IN (${placeholders})`,
      ids,
    );

    await db.execute(`DELETE FROM media WHERE id IN (${placeholders})`, ids);

    const workspace = settingsState.config.workspacePath;
    if (workspace) {
      const mediaDir = await join(workspace, "media");
      const thumbDir = await join(mediaDir, "thumbnails");

      for (const item of results) {
        let filepath = item.filepath;
        if (!filepath.includes("/") && !filepath.includes("\\")) {
          filepath = await join(mediaDir, filepath);
        }
        if (filepath.includes(workspace)) {
          try {
            if (await exists(filepath)) await remove(filepath);
          } catch (e) {}
        }

        if (item.thumbnail_path) {
          const thumbPath = await join(thumbDir, item.thumbnail_path);
          try {
            if (await exists(thumbPath)) await remove(thumbPath);
          } catch (e) {}
        }
      }
    }

    if (this.activeMedia && ids.includes(this.activeMedia.id)) {
      this.activeMedia = null;
    }
    await this.loadAll();
  }

  async delete(id: string) {
    await this.bulkDelete([id]);
  }

  setActive(media: Media | null) {
    this.activeMedia = media;
  }
}

export const media = new MediaState();
