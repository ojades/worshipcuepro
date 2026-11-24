// src/lib/utils/lyrics.ts
import type { Section, Slide } from "$lib/types/models";

const SECTION_COLORS: Record<string, string> = {
  verse: "#3b82f6", // Blue
  chorus: "#8b5cf6", // Neon Violet
  bridge: "#f59e0b", // Amber
  "pre-chorus": "#06b6d4", // Cyan
  vamp: "#ec4899", // Pink
  ending: "#10b981", // Emerald
  outro: "#10b981", // Emerald
  tag: "#10b981", // Emerald
  intro: "#6366f1", // Indigo
};

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

  // Track counts per section type so duplicate labels auto-number cleanly
  const typeCounts: Record<string, number> = {
    verse: 0,
    chorus: 0,
    bridge: 0,
    "pre-chorus": 0,
    vamp: 0,
    ending: 0,
    intro: 0,
  };

  let hasExplicitHeader = false;

  function pushSection() {
    if (!currentText.trim()) return;

    // If the song started without an explicit [Verse] header, count it as Verse 1
    if (!hasExplicitHeader && typeCounts.verse === 0) {
      typeCounts.verse = 1;
      sectionTitle = "Verse 1";
    }

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
      title: sectionTitle,
      type: sectionType,
      color: SECTION_COLORS[sectionType] || "#6366f1",
      slides: sectionSlides,
    });
  }

  const headerRegex =
    /^\[?(verse|chorus|bridge|pre-chorus|pre chorus|vamp|ending|outro|tag|intro)\s*([0-9]+)?\]?:?$/i;

  lines.forEach((line) => {
    const trimmed = line.trim();
    const match = trimmed.match(headerRegex);

    if (match) {
      pushSection();
      hasExplicitHeader = true;
      const keyword = match[1].toLowerCase();
      const explicitNum = match[2];

      if (keyword === "verse") {
        sectionType = "verse";
        typeCounts.verse++;
        sectionTitle = `Verse ${explicitNum || typeCounts.verse}`;
      } else if (keyword === "chorus") {
        sectionType = "chorus";
        typeCounts.chorus++;
        sectionTitle = `Chorus ${explicitNum || typeCounts.chorus}`;
      } else if (keyword === "bridge") {
        sectionType = "bridge";
        typeCounts.bridge++;
        sectionTitle = `Bridge ${explicitNum || typeCounts.bridge}`;
      } else if (keyword === "vamp") {
        sectionType = "vamp";
        typeCounts.vamp++;
        sectionTitle = `Vamp ${explicitNum || typeCounts.vamp}`;
      } else if (keyword.includes("pre")) {
        sectionType = "pre-chorus";
        typeCounts["pre-chorus"]++;
        sectionTitle = `Pre-Chorus ${explicitNum || typeCounts["pre-chorus"]}`;
      } else if (
        keyword === "ending" ||
        keyword === "outro" ||
        keyword === "tag"
      ) {
        sectionType = "ending" as Section["type"];
        typeCounts.ending++;
        const label = keyword.charAt(0).toUpperCase() + keyword.slice(1);
        sectionTitle = `${label} ${explicitNum || typeCounts.ending}`;
      } else if (keyword === "intro") {
        sectionType = "intro" as Section["type"];
        typeCounts.intro++;
        sectionTitle = `Intro ${explicitNum || typeCounts.intro}`;
      }

      currentText = "";
    } else {
      currentText += (currentText ? "\n" : "") + line;
    }
  });

  pushSection();
  return sections;
}
