// Shared "Look" -> CSS filter mapping for the visual filter picked in
// ShortCreationTools at upload time (originally Shorts-only, now also
// offered for Video uploads). Kept in one place so ShortsPageContent.tsx
// (Raftaar feed) and VideoPlayer.tsx (Videos) never drift into two
// different-looking "warm"/"vivid"/"mono" treatments.
export type VideoLookFilter = "original" | "warm" | "vivid" | "mono" | undefined;

export function cssFilterFor(filter: VideoLookFilter): string | undefined {
  switch (filter) {
    case "warm":
      return "sepia(0.35) saturate(1.4) hue-rotate(-8deg) brightness(1.03)";
    case "vivid":
      return "saturate(1.6) contrast(1.15) brightness(1.03)";
    case "mono":
      return "grayscale(1) contrast(1.05)";
    default:
      return undefined;
  }
}
