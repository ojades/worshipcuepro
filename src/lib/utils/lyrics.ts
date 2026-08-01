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

  lines.forEach((line) => {
    const trimmed = line.trim().toLowerCase();
    if (
      ["verse", "chorus", "bridge", "pre-chorus"].some((t) =>
        trimmed.includes(t),
      )
    ) {
      pushSection();
      if (trimmed.includes("verse")) {
        sectionType = "verse";
        sectionTitle = "Verse";
        verseNum++;
      } else if (trimmed.includes("chorus")) {
        sectionType = "chorus";
        sectionTitle = "Chorus";
      } else if (trimmed.includes("bridge")) {
        sectionType = "bridge";
        sectionTitle = "Bridge";
      } else if (trimmed.includes("pre-chorus")) {
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
