// src/lib/state/presentation.svelte.ts
import type { PresentationPayload, Cue, Playlist } from "$lib/types/models";
import { emit, listen } from "@tauri-apps/api/event";
import { parseLyrics } from "$lib/utils/lyrics";
import { songsState } from "$lib/state/songs.svelte";
import { settingsState } from "./settings.svelte";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export class PresentationState {
  // -------------------------
  // Core State (Svelte Runes)
  // -------------------------
  isBlackout = $state(false);
  isTextCleared = $state(false);
  isBackgroundCleared = $state(false);
  currentBackground = $state<{ url: string; type: string } | null>(null);

  activePlaylist = $state<Playlist | null>(null);
  activeCue = $state<Cue | null>(null);
  activeSlideId = $state<string | null>(null);

  // Overlay / Stash State
  stashedCue = $state<Cue | null>(null);
  stashedSlideId = $state<string | null>(null);

  // -------------------------
  // Derived State
  // -------------------------

  // True if we are currently showing a temporary overlay cue
  isOverlayActive = $derived(this.stashedCue !== null);

  allSlidesInCue = $derived(
    this.activeCue?.sections?.flatMap((section: any) => section.slides) || [],
  );

  currentSlideIndex = $derived(
    this.allSlidesInCue.findIndex(
      (slide: any) => slide.id === this.activeSlideId,
    ),
  );

  rawCurrentText = $derived(
    this.currentSlideIndex !== -1
      ? this.allSlidesInCue[this.currentSlideIndex].text
      : "",
  );

  rawNextText = $derived(
    this.currentSlideIndex !== -1 &&
      this.currentSlideIndex + 1 < this.allSlidesInCue.length
      ? this.allSlidesInCue[this.currentSlideIndex + 1].text
      : "",
  );

  // Derive the reference if it exists on the slide (for Bible cues)
  currentReference = $derived(
    this.currentSlideIndex !== -1
      ? this.allSlidesInCue[this.currentSlideIndex].reference || null
      : null,
  );

  // Extract media payload if the slide contains foreground media
  rawCurrentMedia = $derived(
    this.currentSlideIndex !== -1
      ? this.allSlidesInCue[this.currentSlideIndex].media || null
      : null,
  );

  liveText = $derived(
    this.isBlackout || this.isTextCleared ? "" : this.rawCurrentText,
  );

  liveNextText = $derived(
    this.isBlackout || this.isTextCleared ? "" : this.rawNextText,
  );

  liveReference = $derived(
    this.isBlackout || this.isTextCleared ? null : this.currentReference,
  );

  liveMedia = $derived(
    this.isBlackout || this.isTextCleared ? null : this.rawCurrentMedia,
  );

  liveBackground = $derived(
    this.isBlackout || this.isBackgroundCleared ? null : this.currentBackground,
  );

  constructor() {
    this.initSyncListener();
  }

  private async initSyncListener() {
    console.log("[Operator] Presentation state initialized. Listening...");
    try {
      await listen("request-presentation-state", () => {
        console.log("Received Presentation-state request");
        this.broadcastState();
      });
    } catch (err) {
      console.error("[Operator] Failed to bind state listener:", err);
    }
  }

  // Helper method to handle the actual cue swapping logic
  private _applyCue(
    cue: any,
    targetSectionId?: string,
    targetSlideId?: string,
  ) {
    const isSameCue = this.activeCue?.id === cue.id;

    if (isSameCue && cue.type !== "bible") {
      cue.sections = this.activeCue!.sections;
    } else if (cue.type === "media") {
      // --- NEW LOGIC: Safely fallback to converting the raw filepath if asset_url is missing ---
      const safeUrl =
        cue.asset_url || (cue.filepath ? convertFileSrc(cue.filepath) : "");

      cue.sections = [
        {
          id: `media-sec-${cue.id}`,
          title: "Media",
          color: "#06b6d4",
          slides: [
            {
              id: `media-slide-${cue.id}`,
              text: "",
              media: {
                type: cue.media_type || cue.type || "image",
                url: safeUrl, // Use the converted URL here
              },
            },
          ],
        },
      ];
    } else if (
      cue.raw_lyrics !== undefined &&
      (!cue.sections || cue.sections.length === 0)
    ) {
      const lines = cue.lines_per_slide || 0;
      cue.sections = parseLyrics(cue.raw_lyrics, lines);
    } else if (!cue.sections) {
      cue.sections = [];
    }

    this.activeCue = cue;

    if (targetSlideId) {
      this.activeSlideId = targetSlideId;
    } else if (targetSectionId) {
      const section =
        cue.sections.find((s: any) => s.id === targetSectionId) ||
        cue.sections[0];
      this.activeSlideId = section?.slides[0]?.id || null;
    } else {
      this.activeSlideId = cue.sections[0]?.slides[0]?.id || null;
    }

    this.isTextCleared = false;
    this.broadcastState();
  }

  // Standard fire: Clears any active overlay and fires the main cue
  fire(cue: any, targetSectionId?: string, targetSlideId?: string) {
    this.stashedCue = null;
    this.stashedSlideId = null;
    this._applyCue(cue, targetSectionId, targetSlideId);
  }

  // Overlay fire: Stashes the current cue (if not already stashed) and fires temporarily
  fireOverlay(cue: any, targetSectionId?: string, targetSlideId?: string) {
    if (this.activeCue && !this.stashedCue) {
      this.stashedCue = this.activeCue;
      this.stashedSlideId = this.activeSlideId;
    }
    this._applyCue(cue, targetSectionId, targetSlideId);
  }

  // Restores the stashed cue back to the active position
  dismissOverlay() {
    if (this.stashedCue) {
      this.activeCue = this.stashedCue;
      this.activeSlideId = this.stashedSlideId;

      this.stashedCue = null;
      this.stashedSlideId = null;

      this.broadcastState();
    }
  }

  private chunkProse(text: string, maxLines: number): string[] {
    if (!maxLines || maxLines <= 0) return [text];

    const maxChars = maxLines * 50; // Estimate 50 chars per line
    if (text.length <= maxChars) return [text];

    const words = text.split(" ");
    const chunks: string[] = [];
    let currentChunk = "";

    for (const word of words) {
      if (currentChunk.length + word.length + 1 > maxChars) {
        chunks.push(currentChunk.trim());
        currentChunk = word + " ";
      } else {
        currentChunk += word + " ";
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  // Renamed from updateSongLayout to handle Bibles as well
  updateCueLayout(lines: number) {
    const cue = this.activeCue as any;
    if (!cue) return;

    const currentSectionIndex = cue.sections?.findIndex((s: any) =>
      s.slides.some((sl: any) => sl.id === this.activeSlideId),
    );

    cue.lines_per_slide = lines;

    if (cue.type === "bible" && cue.sections) {
      // Handle Bibles: Reconstruct the verse and re-chunk it dynamically
      cue.sections = cue.sections.map((section: any) => {
        // Reconstruct original text by joining current chunks
        const fullText = section.slides.map((s: any) => s.text).join(" ");
        const chunks = this.chunkProse(fullText, lines);

        return {
          ...section,
          slides: chunks.map((chunkText: string, i: number) => ({
            id: `${section.id}_slide_${i}`,
            text: chunkText,
            reference: `${section.title} (${cue.artist})`,
          })),
        };
      });
    } else if (cue.raw_lyrics !== undefined) {
      // Handle Songs: Use standard parser and update DB
      cue.sections = parseLyrics(cue.raw_lyrics, lines);

      songsState.update(cue.id, {
        title: cue.title,
        artist: cue.artist,
        lines_per_slide: lines,
        raw_lyrics: cue.raw_lyrics,
      });
    } else {
      return;
    }

    // Attempt to retain the slide we were looking at
    if (currentSectionIndex !== -1 && cue.sections[currentSectionIndex]) {
      this.activeSlideId = cue.sections[currentSectionIndex].slides[0].id;
    } else {
      this.activeSlideId = cue.sections[0]?.slides[0]?.id || null;
    }

    this.broadcastState();
  }

  async updateSongLyrics(newLyrics: string) {
    const cue = this.activeCue as any;
    if (!cue || cue.raw_lyrics === undefined) return;

    const currentIndex = this.currentSlideIndex;

    cue.raw_lyrics = newLyrics;
    cue.sections = parseLyrics(newLyrics, cue.lines_per_slide || 0);

    const newFlatSlides = cue.sections.flatMap((s: any) => s.slides);

    if (newFlatSlides.length > 0) {
      const safeIndex = Math.min(
        currentIndex > -1 ? currentIndex : 0,
        newFlatSlides.length - 1,
      );
      this.activeSlideId = newFlatSlides[safeIndex].id;
    } else {
      this.activeSlideId = null;
    }

    this.broadcastState();

    await songsState.update(cue.id, {
      title: cue.title,
      artist: cue.artist,
      lines_per_slide: cue.lines_per_slide,
      raw_lyrics: newLyrics,
    });
  }

  nextSlide() {
    if (
      this.currentSlideIndex !== -1 &&
      this.currentSlideIndex + 1 < this.allSlidesInCue.length
    ) {
      this.activeSlideId = this.allSlidesInCue[this.currentSlideIndex + 1].id;
      this.isTextCleared = false;
      this.broadcastState();
    }
  }

  prevSlide() {
    if (this.currentSlideIndex > 0) {
      this.activeSlideId = this.allSlidesInCue[this.currentSlideIndex - 1].id;
      this.isTextCleared = false;
      this.broadcastState();
    }
  }

  nextSection() {
    if (!this.activeCue || !this.activeCue.sections) return;
    const sections = this.activeCue.sections;

    const currentSecIndex = sections.findIndex((sec: any) =>
      sec.slides.some((s: any) => s.id === this.activeSlideId),
    );

    if (currentSecIndex !== -1 && currentSecIndex + 1 < sections.length) {
      this.activeSlideId = sections[currentSecIndex + 1].slides[0]?.id || null;
      this.isTextCleared = false;
      this.broadcastState();
    }
  }

  prevSection() {
    if (!this.activeCue || !this.activeCue.sections) return;
    const sections = this.activeCue.sections;

    const currentSecIndex = sections.findIndex((sec: any) =>
      sec.slides.some((s: any) => s.id === this.activeSlideId),
    );

    if (currentSecIndex > 0) {
      this.activeSlideId = sections[currentSecIndex - 1].slides[0]?.id || null;
      this.isTextCleared = false;
      this.broadcastState();
    }
  }

  toggleBlackout() {
    this.isBlackout = !this.isBlackout;
    this.broadcastState();
  }

  toggleClearText() {
    this.isTextCleared = !this.isTextCleared;
    this.broadcastState();
  }

  setBackground(url: string, type: string) {
    this.currentBackground = { url, type };
    if (this.isBackgroundCleared) {
      this.isBackgroundCleared = false;
    }
    this.broadcastState();
  }

  clearActiveCue() {
    this.activeCue = null;
    this.activeSlideId = null;
    this.stashedCue = null;
    this.stashedSlideId = null;

    // this.isBlackout = false;
    this.isTextCleared = true;
    this.isBackgroundCleared = false;
    // this.currentBackground = null;

    this.broadcastState();
  }

  public async broadcastState() {
    // 1. Local displays payload
    const payload: any = {
      liveText: this.liveText,
      nextText: this.liveNextText,
      liveReference: this.liveReference,
      liveBackground: this.liveBackground,
      liveMedia: this.liveMedia,
      isBlackout: this.isBlackout,
      isTextCleared: this.isTextCleared,
      alignment: settingsState.config.projectorAlignment,
      referencePosition:
        (settingsState.config as any).bibleReferencePosition || "bottom-right",
      textScale: settingsState.config.textScale,
      stageTextScale: settingsState.config.stageTextScale,
    };

    // 2. OBS Network payload
    let obsType: "lyric" | "bible" | null = null;
    let obsText = this.liveText;
    let obsSubText = this.liveReference || undefined;

    // If the screen is cleared, blacked out, or there is no text, tell OBS to hide
    if (
      this.isBlackout ||
      this.isTextCleared ||
      !this.activeCue ||
      !this.liveText
    ) {
      obsType = null;
      obsText = "";
    } else if (this.activeCue.type === "bible") {
      obsType = "bible";
    } else if (
      this.activeCue.type === "song" ||
      this.activeCue.raw_lyrics !== undefined
    ) {
      obsType = "lyric";
    }

    try {
      // Fire to local projector and stage displays (Tauri Event)
      await emit("presentation-update", payload);

      // Fire to LAN OBS Broadcast Server (Tauri Command -> Rust -> WebSockets)
      await invoke("broadcast_to_obs", {
        cueData: {
          type: obsType,
          text: obsText,
          subText: obsSubText,
        },
      });
    } catch (error) {
      console.error("Failed to broadcast state:", error);
    }
  }
}

export const presentation = new PresentationState();
