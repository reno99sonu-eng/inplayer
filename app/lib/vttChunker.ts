/**
 * Detects whether a WebVTT string actually contains real spoken dialogue,
 * or if it is just ASR hallucinated noise, silent background audio, music tags, or gibberish.
 */
export function isMeaningfulSpeechTranscript(vttContent: string): boolean {
  if (!vttContent || !vttContent.includes("-->")) return false;

  const lines = vttContent.split(/\r?\n/);
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("WEBVTT") || trimmed.includes("-->") || /^\d+$/.test(trimmed)) {
      continue;
    }
    textLines.push(trimmed);
  }

  const combinedText = textLines.join(" ").trim();
  if (!combinedText) return false;

  // Filter out pure noise / music / hallucinated silence markers
  const cleanSpeech = combinedText
    .replace(/\[[^\]]+\]/g, "") // Remove [Music], [Applause], [Silence]
    .replace(/\([^)]+\)/g, "") // Remove (music), (sighs)
    .replace(/[♪♫#…._\-\s]+/g, " ") // Remove music symbols, dots, dashes
    .trim();

  const words = cleanSpeech.split(/\s+/).filter((w) => w.length > 1);
  return words.length >= 3;
}

/**
 * Intelligent WebVTT cue chunker.
 * Takes any WebVTT content (even if Mux or AI dumped a massive 8-line paragraph into a single cue)
 * and automatically splits long cues into clean, short 1-line or 2-line YouTube-style subtitle chunks (max 8-10 words per cue).
 */
export function splitLongVttCues(vttContent: string): string {
  if (!vttContent || !vttContent.includes("-->")) return vttContent;

  const lines = vttContent.split(/\r?\n/);
  const resultHeader: string[] = [];
  const cueBlocks: { startTime: string; endTime: string; text: string }[] = [];

  let inHeader = true;
  let currentStart = "";
  let currentEnd = "";
  let currentTextLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (inHeader) {
      resultHeader.push(line);
      if (line.includes("-->") || trimmed === "") {
        inHeader = false;
      }
      continue;
    }

    if (line.includes("-->")) {
      // Process previous cue if any
      if (currentStart && currentEnd && currentTextLines.length > 0) {
        cueBlocks.push({
          startTime: currentStart,
          endTime: currentEnd,
          text: currentTextLines.join(" ").trim(),
        });
      }

      const parts = line.split("-->");
      currentStart = parts[0].trim();
      currentEnd = parts[1].trim().split(" ")[0]; // Strip optional cue settings
      currentTextLines = [];
    } else if (trimmed !== "" && !/^\d+$/.test(trimmed)) {
      currentTextLines.push(trimmed);
    }
  }

  // Push last cue
  if (currentStart && currentEnd && currentTextLines.length > 0) {
    cueBlocks.push({
      startTime: currentStart,
      endTime: currentEnd,
      text: currentTextLines.join(" ").trim(),
    });
  }

  if (cueBlocks.length === 0) return vttContent;

  // Helper to convert VTT timestamp (00:00:01.000) to seconds
  const parseSec = (ts: string): number => {
    const clean = ts.replace(",", ".");
    const parts = clean.split(":");
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(clean) || 0;
  };

  // Helper to convert seconds to VTT timestamp string
  const formatSec = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = (sec % 60).toFixed(3);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const padMs = (str: string) => {
      const parts = str.split(".");
      return `${pad(parseInt(parts[0], 10))}.${(parts[1] || "000").padEnd(3, "0").slice(0, 3)}`;
    };
    return `${pad(h)}:${pad(m)}:${padMs(s)}`;
  };

  const newCues: string[] = ["WEBVTT\n"];

  for (const block of cueBlocks) {
    const startSec = parseSec(block.startTime);
    const endSec = parseSec(block.endTime);
    const duration = Math.max(0.5, endSec - startSec);

    // Split text into words
    const words = block.text.split(/\s+/).filter(Boolean);
    const MAX_WORDS_PER_CUE = 9; // YouTube-style short cue limit

    if (words.length <= MAX_WORDS_PER_CUE) {
      // Already a short cue
      newCues.push(`${block.startTime} --> ${block.endTime}\n${block.text}\n`);
    } else {
      // Split giant paragraph into small timed chunks
      const chunkCount = Math.ceil(words.length / MAX_WORDS_PER_CUE);
      const timePerChunk = duration / chunkCount;

      for (let i = 0; i < chunkCount; i++) {
        const chunkWords = words.slice(i * MAX_WORDS_PER_CUE, (i + 1) * MAX_WORDS_PER_CUE);
        const chunkText = chunkWords.join(" ");
        const chunkStart = startSec + i * timePerChunk;
        const chunkEnd = i === chunkCount - 1 ? endSec : startSec + (i + 1) * timePerChunk;

        newCues.push(`${formatSec(chunkStart)} --> ${formatSec(chunkEnd)}\n${chunkText}\n`);
      }
    }
  }

  return newCues.join("\n");
}
