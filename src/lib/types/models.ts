// src/lib/types/models.ts
export interface PresentationPayload {
  liveText: string;
  nextText: string;
  liveBackground: { url: string; type: string; playbackRate?: number } | null;
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
  playbackRate?: number;
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
export interface TextFormatConfig {
  fontFamily: string;
  fontSizeScale: number; // e.g. 1.0, 1.2
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  fontWeight: "normal" | "medium" | "semibold" | "bold" | "800";
  letterSpacing: number; // in px or em
  lineHeight: number; // e.g. 1.2
  textAlign: "left" | "center" | "right";
  textStrokeWidth: number; // in px
  textStrokeColor: string;
  dropShadow: boolean;
}
export interface DisplayConfig {
  textScale?: number;
  textVAlign?: "top" | "middle" | "bottom";
  referencePosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  textFormat?: TextFormatConfig;
  vGap?: number;
}

export interface AppSettings {
  workspacePath?: string | null;
  enabledBibles: string[];
  linesPerSlide?: number;
  projector?: DisplayConfig;
  stage?: DisplayConfig;
  obsTemplates?: {
    lyric: string;
    bible: string;
  };
}

export type SongCue = Cue & {
  key?: string;
  tempo?: number;
  ccli?: string;
  raw_lyrics?: string;
};
