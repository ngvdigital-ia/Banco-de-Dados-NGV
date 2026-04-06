const VTURB_BASE_URL = "https://api.vturb.com.br/api";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.VTURB_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export type VturbVideoAnalytics = {
  id: string;
  title: string;
  views: number;
  uniqueViews: number;
  playRate: number;
  avgWatchTime: number;
  retention: Record<string, number>;
};

export async function fetchVideos() {
  const apiKey = process.env.VTURB_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${VTURB_BASE_URL}/videos`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[VTurb] List videos failed (${res.status}): ${text}`);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error("[VTurb] List videos error:", err);
    return null;
  }
}

export async function fetchVideoAnalytics(videoId: string) {
  const apiKey = process.env.VTURB_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${VTURB_BASE_URL}/videos/${videoId}/analytics`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[VTurb] Analytics failed (${res.status}): ${text}`);
      return null;
    }

    return res.json() as Promise<VturbVideoAnalytics>;
  } catch (err) {
    console.error("[VTurb] Analytics error:", err);
    return null;
  }
}

/**
 * Extract video ID from a VTurb/BTube URL.
 * Examples:
 * - https://player.vturb.com.br/abc123
 * - https://btube.com/embed/abc123
 * - abc123 (just the ID)
 */
export function extractVideoId(url: string): string | null {
  if (!url) return null;

  // If it's just an ID (no slashes)
  if (!url.includes("/")) return url;

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    // Not a valid URL, try to extract last segment
    const parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  }
}
