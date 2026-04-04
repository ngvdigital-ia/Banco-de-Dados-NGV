const UTMIFY_BASE_URL = "https://api.utmify.com.br";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.UTMIFY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export type UtmifyDashboard = {
  id: string;
  name: string;
  currency: string;
  timeZone: number;
};

export type UtmifyDashboardSummary = {
  ordersCount: {
    total: number;
    approved: number;
    pending: number;
    refunded: number;
  };
  adSpend: number;
  revenue: number;
  grossRevenue: number;
  profit: number;
  cpa: number | null;
  roas: number | null;
};

export type UtmifyAdObject = {
  id: string;
  name: string;
  level: string;
  revenue: number;
  grossRevenue: number;
  totalOrdersCount: number;
  approvedOrdersCount: number;
  spend: number;
  cpa: number | null;
  roas: number | null;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
};

// Known dashboards from MCP discovery
export const DASHBOARDS: UtmifyDashboard[] = [
  { id: "668318317423b9c8af5f8bf9", name: "Principal-NGV DIGITAL", currency: "BRL", timeZone: -3 },
  { id: "69654a9bbbb4781f7e2397ef", name: "Dash Conta em Dolar", currency: "USD", timeZone: -5 },
];

function buildDateRange(timezone: number) {
  const now = new Date();
  // Yesterday in the dashboard's timezone
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const tzStr = timezone >= 0 ? `+${String(timezone).padStart(2, "0")}:00` : `-${String(Math.abs(timezone)).padStart(2, "0")}:00`;
  const dateStr = yesterday.toISOString().split("T")[0];

  return {
    from: `${dateStr}T00:00:00${tzStr}`,
    to: `${dateStr}T23:59:59${tzStr}`,
  };
}

export async function fetchDashboardSummary(dashboardId: string, timezone: number) {
  const dateRange = buildDateRange(timezone);

  const res = await fetch(`${UTMIFY_BASE_URL}/v1/dashboards/${dashboardId}/summary`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ dateRange }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UTMify summary failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<UtmifyDashboardSummary>;
}

export async function fetchMetaAdObjects(dashboardId: string, timezone: number) {
  const dateRange = buildDateRange(timezone);

  const res = await fetch(`${UTMIFY_BASE_URL}/v1/dashboards/${dashboardId}/meta/ad-objects`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ dateRange, level: "campaign" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UTMify Meta ads failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<{ results: UtmifyAdObject[] }>;
}
