// src/lib/types/models.ts
export interface PresentationPayload {
  liveText: string;
  nextText: string;
  liveBackground: { url: string; type: string } | null;
  isBlackout: boolean;
  isTextCleared: boolean;
  liveReference?: string | null;
  linesPerSlide?: number;
  liveMedia?: MediaType;
  projector: DisplayConfig | null;
  stage: DisplayConfig | null;
}

export interface MediaType {
  type: "image" | "video";
  url: string;
}

export interface Slide {
  id: string;
  text: string;
  media?: MediaType;
  notes?: string;
  backgroundId?: string;
}

export interface Section {
  id: string;
  type?: string;
  title: string; // e.g., "Verse 1", "Chorus", "Main Point"
  color?: string; // Useful for color-coding buttons in the Operator view
  slides: Slide[];
}

export interface Cue {
  id: string;
  title: string; // e.g., "How Great Is Our God", "Romans 8:28"
  type: "song" | "scripture" | "announcement" | "bible";
  sections: Section[];
  playlist_item_id?: string;
  raw_lyrics?: string;
}

export interface Playlist {
  id: string;
  name: string; // e.g., "Sunday Morning Worship"
  date?: Date | string;
  cues: Cue[];
}
export interface DisplayConfig {
  textScale?: number;
  textVAlign?: "top" | "middle" | "bottom";
  referencePosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

export interface AppSettings {
  workspacePath: string | null;
  enabledBibles: string[];
  linesPerSlide?: number;
  projector?: DisplayConfig;
  stage?: DisplayConfig;
}

export type SongCue = Cue & {
  key?: string;
  tempo?: number;
  ccli?: string;
  raw_lyrics?: string;
};
