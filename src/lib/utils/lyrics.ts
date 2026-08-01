// src/lib/utils/lyrics.ts
import type { Section, Slide } from "$lib/types/models";

export function parseLyrics(
  rawText: string,
  linesPerSlide: number = 0,
): Section[] {
  if (!rawText) return [];
  const lines = rawText.split("\n");
  const sections: Section[] = [];

  let currentText = "";
  let sectionTitle = "Verse 1";
  let sectionType: Section["type"] = "verse";
  let verseNum = 0;

  function pushSection() {
    if (!currentText.trim()) return;

    const sectionSlides: Slide[] = [];
    const manualChunks = currentText.trim().split(/\n\s*\n/);

    manualChunks.forEach((chunk) => {
      if (linesPerSlide > 0) {
        const chunkLines = chunk.split("\n");
        for (let i = 0; i < chunkLines.length; i += linesPerSlide) {
          sectionSlides.push({
            id: crypto.randomUUID(),
            text: chunkLines.slice(i, i + linesPerSlide).join("\n"),
          });
        }
      } else {
        sectionSlides.push({
          id: crypto.randomUUID(),
          text: chunk,
        });
      }
    });

    sections.push({
      id: crypto.randomUUID(),
      title: sectionType === "verse" ? `Verse ${verseNum}` : sectionTitle,
      type: sectionType,
      slides: sectionSlides,
    });
  }

  // Regex breakdown:
  // ^\[?         -> Must start at the beginning of the line, optional '['
  // (verse|chorus|bridge|pre-chorus|pre chorus) -> The exact keywords
  // \s*          -> Optional whitespace
  // ([0-9]+)?    -> Optional numbers (e.g., Verse 1, Verse 2)
  // \]?          -> Optional closing ']'
  // :?           -> Optional colon (e.g., Chorus:)
  // $            -> Must be the end of the line (prevents "Bridge is falling down")
  const headerRegex =
    /^\[?(verse|chorus|bridge|pre-chorus|pre chorus|vamp)\s*([0-9]+)?\]?:?$/i;

  lines.forEach((line) => {
    const trimmed = line.trim();
    const match = trimmed.match(headerRegex);

    if (match) {
      pushSection();

      // match[1] contains the actual keyword found (verse, chorus, etc.)
      const keyword = match[1].toLowerCase();

      if (keyword === "verse") {
        sectionType = "verse";
        sectionTitle = "Verse";
        verseNum++;
      } else if (keyword === "chorus") {
        sectionType = "chorus";
        sectionTitle = "Chorus";
      } else if (keyword === "bridge") {
        sectionType = "bridge";
        sectionTitle = "Bridge";
      } else if (keyword.includes("pre")) {
        // Catches both "pre-chorus" and "pre chorus"
        sectionType = "pre-chorus";
        sectionTitle = "Pre-Chorus";
      }
      currentText = "";
    } else {
      currentText += (currentText ? "\n" : "") + line;
    }
  });

  pushSection();
  return sections;
}
