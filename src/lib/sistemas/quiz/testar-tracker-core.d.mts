// Declaração de tipos pro adapter testar-tracker-core.mjs (mesma convenção .d.mts ao lado do
// .mjs que o TS resolve sob "moduleResolution": "bundler", igual analytics-client.d.mts).

export declare const QUIZ_TRACK_PATH: "/api/track";
export declare const ANALYTICS_ALLOWED_ORIGINS_VAR: "ANALYTICS_ALLOWED_ORIGINS";
export declare const ANALYTICS_ALLOWED_PROJECT_IDS_VAR: "ANALYTICS_ALLOWED_PROJECT_IDS";
export declare const ANALYTICS_ALLOWED_FUNNEL_IDS_VAR: "ANALYTICS_ALLOWED_FUNNEL_IDS";

export declare class TestarTrackerError extends Error {
  code: string;
  constructor(code: string, message?: string);
}

export interface TestarTrackerConfigInput {
  trackerOrigin?: string;
  hostAllowlist?: string | string[];
  timeoutMs?: number;
  fetchImpl?: typeof globalThis.fetch;
}

export interface TestarTrackerConfig {
  trackerOrigin: string;
  hostAllowlist: string | string[];
  timeoutMs: number;
}

export declare function resolveTestarTrackerConfig(options?: TestarTrackerConfigInput): TestarTrackerConfig;

export declare function validateTrackerUrl(
  trackerOrigin: unknown,
  allowlistedHosts: string | string[] | null | undefined,
): URL;

export declare function normalizeFunnelOrigin(raw: unknown): string | null;

export interface ForbiddenTranslation {
  envVar: string | null;
  message: string;
}

export declare function translateTrackerForbidden(rawMessage: unknown, value: string): ForbiddenTranslation;

export interface TrackerOriginCheckResult {
  checked: true;
  ok: boolean;
  code: string;
  status: number | null;
  envVar: string | null;
  message: string;
}

export declare function checkTrackerOrigin(
  funnelOrigin: string,
  options?: TestarTrackerConfigInput,
): Promise<TrackerOriginCheckResult>;

export interface TestarTrackerFieldResult {
  value: string;
  checked: boolean;
  ok?: boolean;
  code?: string;
  status?: number | null;
  envVar: string | null;
  message: string;
}

export interface TestarTrackerRouteResult {
  status: number;
  body: {
    error?: string;
    code?: string;
    origin?: TestarTrackerFieldResult;
    projectId?: TestarTrackerFieldResult;
    funnelId?: TestarTrackerFieldResult;
  };
}

export declare function handleTestarTrackerRequest(
  payload: unknown,
  options?: TestarTrackerConfigInput,
): Promise<TestarTrackerRouteResult>;
