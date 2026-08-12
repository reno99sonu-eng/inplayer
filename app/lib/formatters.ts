export function formatDuration(seconds: number): string {
    if (!seconds) return "0:00";
    const totalSeconds = Math.round(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  
  export function formatTimeAgo(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diffMs / 60000);
  
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
  
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
  
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
  
  export function formatViews(count: number): string {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`;
    return `${count} views`;
  }

  // Same compacting rule as formatViews (1.2K / 3.4M) but with no fixed
  // suffix, so it works for likes/comments/any other count a card wants to
  // label itself (e.g. `${formatCompactNumber(n)} likes`).
  export function formatCompactNumber(count: number): string {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return `${count}`;
  }