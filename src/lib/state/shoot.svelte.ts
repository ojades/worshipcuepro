// /src/lib/state/shoot.svelte.ts
import { getDB } from "$lib/db";
import type { Cue } from "$lib/types/models";
import { convertFileSrc } from "@tauri-apps/api/core";

export type Shoot = {
  id: string;
  title: string;
  cue: Cue;
};

export interface ShootMeta {
  id: string;
  title: string;
  slideCount: number;
}

export class ShootState {
  allShoots = $state<ShootMeta[]>([]);

  // Fetch all shoots for the grid view
  async loadAll() {
    const db = getDB();
    try {
      const results = await db.select<ShootMeta[]>(`
        SELECT
          sh.id,
          sh.title,
          COUNT(ss.id) as slideCount
        FROM shoots sh
        LEFT JOIN shoot_slides ss ON sh.id = ss.shoot_id
        GROUP BY sh.id
        ORDER BY sh.created_at DESC
      `);
      this.allShoots = results;
    } catch (error) {
      console.error("Failed to load shoots:", error);
    }
  }

  async getShootSlides(shootId: string) {
    const db = getDB();
    try {
      const rawSlides = await db.select<any[]>(
        `
            SELECT ps.id, ps.media_id, m.filepath, m.type as media_type
            FROM shoot_slides ps
            JOIN media m ON ps.media_id = m.id
            WHERE ps.shoot_id = $1
            ORDER BY ps.sort_order ASC
          `,
        [shootId],
      );

      return rawSlides.map((slide) => ({
        id: slide.id,
        media_id: slide.media_id,
        filepath: slide.filepath,
        media_type: slide.media_type,
        asset_url: convertFileSrc(slide.filepath),
      }));
    } catch (error) {
      console.error("Failed to fetch shoot slides:", error);
      return [];
    }
  }

  // Create or Update a shoot and its slides
  async saveShoot(id: string | null, title: string, slides: any[]) {
    const db = getDB();
    if (!id) id = crypto.randomUUID();
    try {
      // 1. Upsert the Shoot record
      const existing = await db.select("SELECT id FROM shoots WHERE id = $1", [
        id,
      ]);
      if (existing.length > 0) {
        await db.execute("UPDATE shoots SET title = $1 WHERE id = $2", [
          title,
          id,
        ]);
      } else {
        await db.execute("INSERT INTO shoots (id, title) VALUES ($1, $2)", [
          id,
          title,
        ]);
      }

      // 2. Wipe existing slides and rewrite (cleanest way to handle reordering & deletions)
      await db.execute("DELETE FROM shoot_slides WHERE shoot_id = $1", [id]);

      // 3. Insert new slides with updated sort_order
      for (let i = 0; i < slides.length; i++) {
        await db.execute(
          "INSERT INTO shoot_slides (id, shoot_id, media_id, sort_order) VALUES ($1, $2, $3, $4)",
          [crypto.randomUUID(), id, slides[i].media_id, i],
        );
      }

      await this.loadAll();

      return id;
    } catch (error) {
      console.error("Failed to save shoot:", error);
    }
  }

  // Delete a shoot
  async deleteShoot(id: string) {
    const db = getDB();
    try {
      await db.execute("DELETE FROM shoot_slides WHERE shoot_id = $1", [id]);
      await db.execute("DELETE FROM shoots WHERE id = $1", [id]);
      await this.loadAll();
    } catch (error) {
      console.error("Failed to delete shoot:", error);
    }
  }

  // Generate the Cue object for PresentationState
  async getShoot(shootId: string) {
    const db = getDB();
    let shoot: Shoot;
    let rawSlides: {
      id: string;
      sort_order: number;
      filepath: string;
      media_type: string;
    }[];

    [shoot] = await db.select("SELECT * FROM shoots WHERE id = $1", [shootId]);

    rawSlides = await db.select(
      `
        SELECT ps.id, ps.sort_order, m.filepath, m.type as media_type
        FROM shoot_slides ps
        JOIN media m ON ps.media_id = m.id
        WHERE ps.shoot_id = $1
        ORDER BY ps.sort_order ASC
    `,
      [shootId],
    );

    return {
      id: shoot.id,
      type: "shoot",
      title: shoot.title,
      sections: [
        {
          id: `sec_${shoot.id}`,
          title: "Slides",
          color: "#8b5cf6",
          slides: rawSlides.map((slide) => ({
            id: slide.id,
            text: "",
            media: {
              type: slide.media_type,
              url: convertFileSrc(slide.filepath),
            },
          })),
        },
      ],
    };
  }
}

export const shootState = new ShootState();
