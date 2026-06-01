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

// Mapping of UTMify product names → internal offer names
// Used to link UTMify revenue/spend data to VTurb VSL performance
export const PRODUCT_TO_OFFER: Record<string, string> = {
  "Automatic Videos Factory": "FVA",
  "Vigor Max": "Vigor Max",
  "VigorMax": "Vigor Max",
  "Le Code de la Femme Irrésistible": "Le Code de la Femme",
  " Le Code de la Femme Irrésistible": "Le Code de la Femme",
  "Skyvault": "SkyVault",
  "S.ky.Vault": "SkyVault",
  "-Skyvault-": "SkyVault",
  "SkyVault": "SkyVault",
  "Skyvault Default": "SkyVault",
  "Guardian Angel Reconnection Prayer": "Guardian Angel",
  "DaVinci Frequency": "DaVinci Frequency",
  "The DaVinci Frequency": "DaVinci Frequency",
  "African Water": "African Water",
  "Prayer of the king of Solomon": "Salomao",
  "King Solomon's Prayer": "Salomao",
  "King Solomon's Prayer Default": "Salomao",
  "Orgasmic - Massages": "Orgasmic Rides",
  "Addictive Rides Program": "Orgasmic Rides",
  "App Penna Naturale": "Penna Naturale",
  "Sciatic Shield": "Sciatic Shield",
  "Sciatic Shield Default": "Sciatic Shield",
  "Chia Seed Hack": "Chia Seed",
  "American Reimbursement System": "American System",
  "God Fingers": "God Fingers",
  "Neuropeak": "NeuroPeak",
  "ALPHA FLOW": "ALPHA FLOW",
  "The Allicin Reset Protocol": "The Allicin Reset Protocol",
};

// Get all unique offer names from product mapping
export function getKnownOffers(): string[] {
  return [...new Set(Object.values(PRODUCT_TO_OFFER))].sort();
}

// Get product names for a given offer
export function getProductNamesForOffer(offerName: string): string[] {
  return Object.entries(PRODUCT_TO_OFFER)
    .filter(([, offer]) => offer === offerName)
    .map(([product]) => product);
}

export type OfferMetrics = {
  offerName: string;
  spend: number;       // centavos
  revenue: number;     // centavos
  profit: number;      // centavos
  orders: number;
  clicks: number;
  checkouts: number;
  costPerCheckout: number | null;
  cpa: number | null;
  roas: number | null;
  currency: string;
};

/**
 * Fetch UTMify metrics for a specific offer (by product name filter).
 */
export async function fetchOfferMetrics(
  dashboardId: string,
  timezone: number,
  currency: string,
  offerName: string,
  dateFrom: string,
  dateTo: string,
): Promise<OfferMetrics | null> {
  const productNames = getProductNamesForOffer(offerName);
  if (productNames.length === 0) return null;

  const tzStr = timezone >= 0 ? `+${String(timezone).padStart(2, "0")}:00` : `-${String(Math.abs(timezone)).padStart(2, "0")}:00`;
  const dateRange = {
    from: `${dateFrom}T00:00:00${tzStr}`,
    to: `${dateTo}T23:59:59${tzStr}`,
  };

  try {
    const res = await fetch(`${UTMIFY_BASE_URL}/v1/dashboards/${dashboardId}/summary`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ dateRange, productNames }),
    });

    if (!res.ok) return null;

    // The UTMify API response has nested structure:
    // ads.spent, comissions.net/gross, analytics.profit/cpa/roas
    const raw = await res.json() as Record<string, unknown>;

    const ads = raw.ads as { spent?: number; clicks?: number; pageViews?: number; initiateCheckouts?: number } | undefined;
    const analytics = raw.analytics as { profit?: number; cpa?: number; roas?: number } | undefined;
    const comissions = raw.comissions as { net?: number; gross?: number } | undefined;
    const ordersCount = raw.ordersCount as { approved?: number; total?: number } | undefined;

    const spend = ads?.spent ?? (raw.adSpend as number) ?? 0;
    const revenue = comissions?.gross ?? (raw.revenue as number) ?? 0;
    const profit = analytics?.profit ?? (raw.profit as number) ?? 0;
    const clicks = ads?.clicks ?? 0;
    const checkouts = ads?.initiateCheckouts ?? 0;

    return {
      offerName,
      spend,
      revenue,
      profit,
      orders: ordersCount?.approved ?? 0,
      clicks,
      checkouts,
      costPerCheckout: checkouts > 0 ? Math.round(spend / checkouts) : null,
      cpa: analytics?.cpa ?? null,
      roas: analytics?.roas ?? null,
      currency,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch UTMify metrics for ALL known offers from both dashboards.
 */
export async function fetchAllOfferMetrics(dateFrom: string, dateTo: string): Promise<OfferMetrics[]> {
  const offers = getKnownOffers();
  const results: OfferMetrics[] = [];

  // Use USD dashboard (most offers are there)
  const usdDash = DASHBOARDS.find((d) => d.currency === "USD");
  if (!usdDash) return [];

  // Fetch in parallel (max 5 concurrent to avoid rate limits)
  const batchSize = 5;
  for (let i = 0; i < offers.length; i += batchSize) {
    const batch = offers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((offer) => fetchOfferMetrics(usdDash.id, usdDash.timeZone, usdDash.currency, offer, dateFrom, dateTo))
    );
    for (const r of batchResults) {
      if (r && (r.spend > 0 || r.revenue > 0)) results.push(r);
    }
  }

  return results.sort((a, b) => b.spend - a.spend);
}

// Abbreviations used in UTMify campaign names (pattern: DD/MM-TIPO-OFERTA-IDIOMA)
// Values MUST match offerTracking.name exactly for the join to work
const CAMPAIGN_OFFER_KEYWORDS: Record<string, string> = {
  "FVA": "FVA",
  "VIGORMAX": "Vigor Max",
  "VIGOR MAX": "Vigor Max",
  "VIGOR-MAX": "Vigor Max",
  "VM": "Vigor Max",
  "SKYVAULT": "SkyVault",
  "SKY VAULT": "SkyVault",
  "-SV-": "SkyVault",
  "LECODE": "Le Code de la Femme",
  "LE CODE": "Le Code de la Femme",
  "SOLOMON": "Salomao",
  "SALOMAO": "Salomao",
  "ORS": "Salomao",
  "CHIASEED": "Chia Seed",
  "CHIA SEED": "Chia Seed",
  "CHIA": "Chia Seed",
  "SCIATIC": "Sciatic Shield",
  "DAVINCI": "DaVinci Frequency",
  "DA VINCI": "DaVinci Frequency",
  "GUARDIAN": "Guardian Angel",
  "ANGEL": "Guardian Angel",
  "AFRICAN": "African Water",
  "GODFINGERS": "God Fingers",
  "GOD FINGERS": "God Fingers",
  "ORGASMIC": "Orgasmic Rides",
  "PENNA": "Penna Naturale",
  "NEUROPEAK": "NeuroPeak",
  "ALPHA FLOW": "ALPHA FLOW",
  "ALPHA": "ALPHA FLOW",
  "AMERICAN": "American System",
  "FUNGOS": "The Allicin Reset Protocol",
  "CANDIDIASE": "The Allicin Reset Protocol",
  "MOS": "Salomao",
};

/**
 * Extract offer name from UTMify campaign name.
 * Campaign names follow pattern: DD/MM-TIPO-OFERTA-IDIOMA (e.g. "07/04-TESTE-FVA-EN")
 */
export function extractOfferFromCampaignName(campaignName: string): string {
  const upper = campaignName.toUpperCase();
  // Check longer keywords first to avoid partial matches (e.g. "ALPHA FLOW" before "ALPHA")
  const sorted = Object.entries(CAMPAIGN_OFFER_KEYWORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, offer] of sorted) {
    if (upper.includes(keyword)) return offer;
  }
  return "Outros";
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
