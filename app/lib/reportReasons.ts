// Shared across every "Report" surface (video, comment, direct message) so
// they never drift out of sync. app/components/watch/VideoOptionsMenu.tsx's
// own REPORT_REASONS constant is the original of this list — kept as-is
// there to avoid touching working code, but every new report UI should
// import from here instead of redefining its own copy.
export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "violence", label: "Violent or graphic content" },
  { value: "misinformation", label: "Misinformation" },
  { value: "copyright", label: "Copyright infringement" },
  { value: "other", label: "Something else" },
];

export const VALID_REPORT_REASONS = REPORT_REASONS.map((r) => r.value);
