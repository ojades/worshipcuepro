// src/lib/state/shoot.svelte.ts
import type { Cue } from "$lib/types/models";
import { convertFileSrc } from "@tauri-apps/api/core";
import { media } from "$lib/state/media.svelte";
import {
  fetchAllShootsAPI,
  fetchShootSlidesAPI,
  saveShootAPI,
  deleteShootAPI,
  fetchShootAPI,
  type ShootMeta,
} from "$lib/commands/shoot-db";

export type Shoot = {
  id: string;
  title: string;
  cue: Cue;
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
      const rawSlides = await fetchShootSlidesAPI(shootId);

      return rawSlides.map((slide) => {
        // Find the fully resolved media item to get the absolute asset_url
        const m = media.allMedia.find((x) => x.id === slide.media_id);
        return {
          id: slide.id,
          media_id: slide.media_id,
          filepath: slide.filepath,
          media_type: slide.media_type,
          asset_url: m?.asset_url || convertFileSrc(slide.filepath),
        };
      });
    } catch (error) {
      console.error("Failed to fetch shoot slides:", error);
      return [];
    }
  }

  async saveShoot(id: string | null, title: string, slides: any[]) {
    const shootId = id || crypto.randomUUID();
    try {
      const formattedSlides = slides.map((s) => ({ media_id: s.media_id }));
      await saveShootAPI(shootId, title, formattedSlides);
      await this.loadAll();
      return shootId;
    } catch (error) {
      console.error("Failed to save shoot:", error);
    }
  }

  async deleteShoot(id: string) {
    try {
      await deleteShootAPI(id);
      await this.loadAll();
    } catch (error) {
      console.error("Failed to delete shoot:", error);
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
              // Find the fully resolved media item to get the absolute asset_url
              const m = media.allMedia.find((x) => x.id === slide.media_id);
              return {
                id: slide.id,
                text: "",
                media: {
                  type: slide.media_type,
                  url: m?.asset_url || convertFileSrc(slide.filepath),
                },
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
