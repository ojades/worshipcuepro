// src/lib/utils/shortcuts.ts

export type ShortcutDef = {
  key: string;
  alt?: boolean;
  ctrl?: boolean; // Acts as 'Cmd' on Mac, 'Ctrl' on Windows
  shift?: boolean;
  description?: string;
};

// Define your centralized shortcuts here
export const SHORTCUTS = {
  // Global Actions
  BLACKOUT: { key: "b", alt: true, description: "Blackout" },
  CLEAR_TEXT: { key: "c", alt: true, description: "Clear Text" },
  CLEAR_CUE: { key: "x", alt: true, description: "Clear Cues" },
  DISPLAY_MENU: { key: "d", alt: true, description: "Open Display Menu" },

  // Presentation Navigation
  NEXT_SLIDE: { key: "ArrowRight", description: "Next Slide" },
  NEXT_SLIDE_SPACE: { key: " ", description: "Next Slide" },
  PREV_SLIDE: { key: "ArrowLeft", description: "Previous Slide" },
  NEXT_SECTION: { key: "ArrowDown", description: "Next Section" },
  PREV_SECTION: { key: "ArrowUp", description: "Previous Section" },

  // Sidebar Navigation
  NAV_CUES: { key: "1", ctrl: true, description: "Go to Cues" },
  NAV_LYRICS: { key: "2", ctrl: true, description: "Go to Lyrics" },
  NAV_BIBLES: { key: "3", ctrl: true, description: "Go to Bibles" },
  NAV_MEDIA: { key: "4", ctrl: true, description: "Go to Media" },
  NAV_SHOOTS: { key: "5", ctrl: true, description: "Go to Shoots" },
  NAV_SETTINGS: { key: "6", ctrl: true, description: "Go to Settings" },

  // Operator Context Actions
  QUICK_EDIT: { key: "e", ctrl: true, description: "Quick Edit" },
  SAVE_EDIT: { key: "s", ctrl: true, description: "Save Edit" },
  VERSE_JUMP_SLASH: { key: "/", description: "Jump to Verse" },
  VERSE_JUMP_F: { key: "f", description: "Jump to Verse" },
  ESCAPE: { key: "Escape", description: "Cancel" },
  QUICK_FINDER: { key: "k", ctrl: true, description: "Quick Finder" },
};

const isMac =
  typeof window !== "undefined"
    ? navigator.userAgent.toUpperCase().indexOf("MAC") >= 0
    : false;

export function checkShortcut(
  e: KeyboardEvent,
  shortcut: ShortcutDef,
): boolean {
  const isModifierPressed = isMac ? e.metaKey : e.ctrlKey;
  const normalizedCode = e.code
    .replace("Key", "")
    .replace("Digit", "")
    .toLowerCase();

  const isKeyMatch =
    e.key.toLowerCase() === shortcut.key.toLowerCase() ||
    normalizedCode === shortcut.key.toLowerCase();

  return (
    isKeyMatch &&
    !!shortcut.alt === e.altKey &&
    !!shortcut.ctrl === isModifierPressed &&
    !!shortcut.shift === e.shiftKey
  );
}

export function formatShortcut(shortcut: ShortcutDef): string {
  if (isMac) {
    const parts = [];
    if (shortcut.ctrl) parts.push("⌘");
    if (shortcut.alt) parts.push("⌥");
    if (shortcut.shift) parts.push("⇧");

    // Format space and arrows cleanly for Mac tooltips
    let keyName = shortcut.key.toUpperCase();
    if (shortcut.key === " ") keyName = "SPACE";
    if (shortcut.key.includes("Arrow"))
      keyName = shortcut.key.replace("Arrow", "");

    parts.push(keyName);
    return parts.join("");
  } else {
    const parts = [];
    if (shortcut.ctrl) parts.push("Ctrl");
    if (shortcut.alt) parts.push("Alt");
    if (shortcut.shift) parts.push("Shift");

    let keyName = shortcut.key.toUpperCase();
    if (shortcut.key === " ") keyName = "Space";
    if (shortcut.key.includes("Arrow"))
      keyName = shortcut.key.replace("Arrow", "");

    parts.push(keyName);
    return parts.join("+");
  }
}
