// /src/lib/utils/helper.ts

import { confirm } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

export interface NetworkUrls {
  obsUrl: string;
  stageUrl: string;
  localIp: string;
}

export interface ConfirmDialogOptions {
  title?: string;
  kind?: "info" | "warning" | "error";
  message: string;
}

export const confirmDialog = async (
  options: ConfirmDialogOptions,
): Promise<boolean> => {
  return await confirm(options.message, {
    title: options.title,
    kind: options.kind || "warning",
  });
};

/**
 * Retrieves the local network IP address and generates the URLs
 * for the remote Stage Display and OBS Browser Source.
 */
export async function getNetworkUrls(): Promise<NetworkUrls> {
  const port = 8080; // Matches your Axum server bind port

  try {
    // Fetch the actual local IP address from the Rust backend
    const ip = await invoke<string>("get_local_ip");

    return {
      localIp: ip,
      obsUrl: `http://${ip}:${port}/obs`,
      stageUrl: `http://${ip}:${port}/stage`,
    };
  } catch (error) {
    console.warn("Failed to get local IP, falling back to localhost:", error);

    // Fallback if the network is disconnected
    return {
      localIp: "127.0.0.1",
      obsUrl: `http://127.0.0.1:${port}/obs`,
      stageUrl: `http://127.0.0.1:${port}/stage`,
    };
  }
}

// Helper: Break continuous prose into slides based on lines per slide
export function chunkProse(
  text: string,
  maxLines: number,
  fontScale: number = 1.0,
): string[] {
  // 1. Flatten the text to eliminate arbitrary copy-paste line breaks
  const normalizedText = text.replace(/\s*\n\s*/g, " ").trim();

  // NEW: Default to 5 lines if the operator has "Auto" (0) selected
  const effectiveLines = maxLines && maxLines > 0 ? maxLines : 6;

  // NEW: Base capacity is ~45 chars per line.
  // Divide by fontScale so huge fonts force smaller chunks. (Min scale 0.5)
  const maxChars = Math.floor((effectiveLines * 45) / Math.max(fontScale, 0.5));

  if (normalizedText.length <= maxChars) return [normalizedText];

  const chunks: string[] = [];

  // 2. Break text into natural clauses using punctuation.
  const clauses = normalizedText.match(/[^.?!;:,]+[.?!;:,]*["')\]]*\s*/g) || [
    normalizedText,
  ];
  let currentChunk = "";

  const conjunctions = new Set([
    "and",
    "but",
    "or",
    "for",
    "so",
    "yet",
    "with",
    "from",
    "to",
    "in",
    "on",
    "at",
    "by",
    "as",
    "that",
    "which",
    "who",
    "where",
  ]);

  clauses.forEach((clause) => {
    const cleanClause = clause.trim();
    if (!cleanClause) return;

    // 3. If a single phrase is MASSIVE, split it smartly by words
    if (cleanClause.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      const words = cleanClause.split(/\s+/);

      words.forEach((word) => {
        const isConjunction = conjunctions.has(word.toLowerCase());
        const potentialLength = currentChunk.length + word.length + 1;

        // Soft break BEFORE a conjunction if near the limit
        if (isConjunction && currentChunk.length > maxChars * 0.75) {
          chunks.push(currentChunk.trim());
          currentChunk = word;
        } else if (potentialLength > maxChars && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = word;
        } else {
          currentChunk += (currentChunk ? " " : "") + word;
        }
      });
    } else {
      // 4. Normal Clause. Group them if possible!
      const potentialLength =
        currentChunk.length + cleanClause.length + (currentChunk ? 1 : 0);

      if (potentialLength > maxChars && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = cleanClause;
      } else {
        currentChunk += (currentChunk ? " " : "") + cleanClause;
      }
    }
  });

  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks;
}
