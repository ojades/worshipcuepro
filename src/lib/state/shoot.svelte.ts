// src/lib/state/shoot.svelte.ts
import type { Cue } from "$lib/types/models";
import { convertFileSrc } from "@tauri-apps/api/core";
import { media } from "$lib/state/media.svelte";
import { systemState } from "$lib/state/system.svelte";
import { settingsState } from "$lib/state/settings.svelte";
import {
  fetchAllShootsAPI,
  fetchShootSlidesAPI,
  saveShootAPI,
  deleteShootAPI,
  fetchShootAPI,
  type ShootMeta,
  type ShootSlideRow,
} from "$lib/commands/shoot-db";

export type Shoot = {
  id: string;
  title: string;
  cue: Cue;
  text_content: string;
};

export class ShootState {
  allShoots = $state<ShootMeta[]>([]);

  async loadAll() {
    try {
      this.allShoots = await fetchAllShootsAPI();
    } catch (error) {
      console.error("Failed to load shoots:", error);
    }
  }

  async getShootSlides(shootId: string) {
    try {
      const rawSlides: ShootSlideRow[] = await fetchShootSlidesAPI(shootId);

      return rawSlides.map((slide) => {
        const m = slide.media_id
          ? media.allMedia.find((x) => x.id === slide.media_id)
          : null;
        return {
          id: slide.id,
          media_id: slide.media_id,
          filepath: slide.filepath,
          media_type: slide.media_type,
          asset_url:
            m?.asset_url ||
            (slide.filepath ? convertFileSrc(slide.filepath) : null),
          text_content: slide.text_content || "", // NEW
        };
      });
    } catch (error) {
      console.error("Failed to fetch shoot slides:", error);
      return [];
    }
  }

  async saveShoot(id: string | null, title: string, slides: any[]) {
    if (settingsState.isReadOnly) {
      systemState.addAlert({
        message: "Cannot save: Database is in Read-Only mode.",
        type: "warning",
      });
      return;
    }

    const shootId = id || crypto.randomUUID();
    try {
      // Pass text_content up to Rust
      const formattedSlides = slides.map((s) => ({
        media_id: s.media_id || null,
        text_content: s.text_content || null,
      }));
      await saveShootAPI(shootId, title, formattedSlides);
      await this.loadAll();
      return shootId;
    } catch (error) {
      console.error("Failed to save shoot:", error);
      systemState.addAlert({ message: "Failed to save shoot.", type: "error" });
    }
  }

  async deleteShoot(id: string) {
    if (settingsState.isReadOnly) {
      systemState.addAlert({
        message: "Cannot delete: Database is in Read-Only mode.",
        type: "warning",
      });
      return;
    }

    try {
      await deleteShootAPI(id);
      await this.loadAll();
      systemState.addAlert({
        message: "Shoot deleted successfully.",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to delete shoot:", error);
      systemState.addAlert({
        message: "Failed to delete shoot.",
        type: "error",
      });
    }
  }

  async getShoot(shootId: string) {
    try {
      const shoot = await fetchShootAPI(shootId);
      if (!shoot) throw new Error("Shoot not found");

      const rawSlides = await fetchShootSlidesAPI(shootId);

      return {
        id: shoot.id,
        type: "shoot",
        title: shoot.title,
        sections: [
          {
            id: `sec_${shoot.id}`,
            title: "Slides",
            color: "#8b5cf6",
            slides: rawSlides.map((slide) => {
              const m = slide.media_id
                ? media.allMedia.find((x) => x.id === slide.media_id)
                : null;
              const url =
                m?.asset_url ||
                (slide.filepath ? convertFileSrc(slide.filepath) : null);

              return {
                id: slide.id,
                text: slide.text_content || "", // The HTML from Tiptap!
                media: url
                  ? {
                      type: slide.media_type,
                      url: url,
                    }
                  : null,
              };
            }),
          },
        ],
      };
    } catch (error) {
      console.error("Failed to get shoot cue format:", error);
      throw error;
    }
  }
}

export const shootState = new ShootState();
