// VTurb Analytics API
// Docs: https://vturb.gitbook.io/analytics-api/pt
const VTURB_BASE_URL = "https://analytics.vturb.net";

function getHeaders(includeContentType = true) {
  const headers: Record<string, string> = {
    "X-Api-Token": process.env.VTURB_API_KEY!,
    "X-Api-Version": "v1",
  };
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
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
    if (dateFrom) params.set("start_date", dateFrom);
    if (dateTo) params.set("end_date", dateTo);
    if (params.toString()) url += `?${params}`;

    // GET request — do NOT send Content-Type header
    const res = await fetch(url, { headers: getHeaders(false) });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[VTurb] List players failed (${res.status}): ${text}`);
      return null;
    }

    // API returns array directly
    const data = await res.json();
    const players = Array.isArray(data) ? data : data.players || [];
    return { players } as { players: VturbPlayer[] };
  } catch (err) {
    console.error("[VTurb] List players error:", err);
    return null;
  }
}

/**
 * Raw event row from VTurb API
 */
export type VturbEventRow = {
  player_id: string;
  event: string;
  total: number;
  total_uniq_sessions: number;
  total_uniq_device: number;
};

/**
 * Get event totals (plays, views, finishes, clicks) per player.
 * Returns a Map<playerId, { started, finished, viewed, clicked }> for easy lookup.
 */
export async function fetchEventsByPlayer(
  playerIds: string[],
  dateFrom: string,
  dateTo: string,
  timezone = "America/Sao_Paulo"
): Promise<Map<string, { started: number; finished: number; viewed: number; clicked: number }> | null> {
  const apiKey = process.env.VTURB_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${VTURB_BASE_URL}/events/total_by_company_players`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        events: ["started", "finished", "viewed", "clicked"],
        start_date: dateFrom,
        end_date: dateTo,
        timezone,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[VTurb] Events by player failed (${res.status}): ${text}`);
      return null;
    }

    // API returns: [{ player_id, event, total, total_uniq_sessions, total_uniq_device }, ...]
    const rows: VturbEventRow[] = await res.json();
    const playerMap = new Map<string, { started: number; finished: number; viewed: number; clicked: number }>();

    // Only include players we asked for
    const playerSet = new Set(playerIds);

    for (const row of rows) {
      if (!playerSet.has(row.player_id)) continue;

      if (!playerMap.has(row.player_id)) {
        playerMap.set(row.player_id, { started: 0, finished: 0, viewed: 0, clicked: 0 });
      }
      const entry = playerMap.get(row.player_id)!;

      if (row.event === "started") entry.started = row.total;
      else if (row.event === "finished") entry.finished = row.total;
      else if (row.event === "viewed") entry.viewed = row.total;
      else if (row.event === "clicked") entry.clicked = row.total;
    }

    return playerMap;
  } catch (err) {
    console.error("[VTurb] Events by player error:", err);
    return null;
  }
}

/**
 * Get user engagement (retention) for a single player
 */
export async function fetchUserEngagement(
  playerId: string,
  videoDuration: number,
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
        player_id: playerId,
        video_duration: videoDuration,
        start_date: dateFrom,
        end_date: dateTo,
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
 * Get session stats (play rate, avg watch time, etc.) for a single player
 */
export async function fetchSessionStats(
  playerId: string,
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
        player_id: playerId,
        start_date: dateFrom,
        end_date: dateTo,
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
    // GET request — no Content-Type
    const res = await fetch(`${VTURB_BASE_URL}/sessions/live_users?minutes=${minutes}`, {
      headers: getHeaders(false),
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
