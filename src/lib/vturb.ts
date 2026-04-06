// VTurb Analytics API
// Docs: https://vturb.gitbook.io/analytics-api/pt
const VTURB_BASE_URL = "https://analytics.vturb.net";

function getHeaders() {
  return {
    "X-Api-Token": process.env.VTURB_API_KEY!,
    "X-Api-Version": "v1",
    "Content-Type": "application/json",
  };
}

export type VturbPlayer = {
  id: string;
  name: string;
  pitch_time: number;
  duration: number;
  created_at: string;
};

export type VturbEventStats = {
  started: number;
  finished: number;
  viewed: number;
  clicked: number;
  unique_devices: number;
  unique_sessions: number;
};

export type VturbEngagement = {
  total_users: number;
  users_reached: number;
  percentage: number;
};

/**
 * List all players (videos) in the account
 */
export async function fetchPlayers(dateFrom?: string, dateTo?: string) {
  const apiKey = process.env.VTURB_API_KEY;
  if (!apiKey) return null;

  try {
    let url = `${VTURB_BASE_URL}/players/list`;
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_start", dateFrom);
    if (dateTo) params.set("date_end", dateTo);
    if (params.toString()) url += `?${params}`;

    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[VTurb] List players failed (${res.status}): ${text}`);
      return null;
    }

    // API returns array directly, not { players: [...] }
    const data = await res.json();
    const players = Array.isArray(data) ? data : data.players || [];
    return { players } as { players: VturbPlayer[] };
  } catch (err) {
    console.error("[VTurb] List players error:", err);
    return null;
  }
}

/**
 * Get event totals (plays, views, finishes, clicks) per player
 */
export async function fetchEventsByPlayer(
  playerHashes: string[],
  dateFrom: string,
  dateTo: string,
  timezone = "America/Sao_Paulo"
) {
  const apiKey = process.env.VTURB_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${VTURB_BASE_URL}/events/total_by_company_players`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        player_hashes: playerHashes,
        events: ["started", "finished", "viewed", "clicked"],
        date_start: dateFrom,
        date_end: dateTo,
        timezone,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[VTurb] Events by player failed (${res.status}): ${text}`);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error("[VTurb] Events by player error:", err);
    return null;
  }
}

/**
 * Get user engagement (retention) - users reaching specific timestamps
 */
export async function fetchUserEngagement(
  playerHashes: string[],
  dateFrom: string,
  dateTo: string,
  timezone = "America/Sao_Paulo"
) {
  const apiKey = process.env.VTURB_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${VTURB_BASE_URL}/times/user_engagement`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        player_hashes: playerHashes,
        date_start: dateFrom,
        date_end: dateTo,
        timezone,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[VTurb] Engagement failed (${res.status}): ${text}`);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error("[VTurb] Engagement error:", err);
    return null;
  }
}

/**
 * Get session stats (play rate, avg watch time, etc.)
 */
export async function fetchSessionStats(
  playerHashes: string[],
  dateFrom: string,
  dateTo: string,
  timezone = "America/Sao_Paulo"
) {
  const apiKey = process.env.VTURB_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${VTURB_BASE_URL}/sessions/stats`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        player_hashes: playerHashes,
        date_start: dateFrom,
        date_end: dateTo,
        timezone,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[VTurb] Session stats failed (${res.status}): ${text}`);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error("[VTurb] Session stats error:", err);
    return null;
  }
}

/**
 * Get live users count
 */
export async function fetchLiveUsers(minutes = 5) {
  const apiKey = process.env.VTURB_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${VTURB_BASE_URL}/sessions/live_users?minutes=${minutes}`, {
      headers: getHeaders(),
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Extract player hash from a VTurb/BTube embed URL
 * Examples:
 * - https://player.vturb.com.br/abc123def456
 * - abc123def456
 */
export function extractPlayerHash(url: string): string | null {
  if (!url) return null;
  if (!url.includes("/")) return url.trim();

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    const parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  }
}
