// Declaração de tipos pro módulo lookup-core.mjs — as 5 finders de lookup.mjs servidas
// pelo NGV Core (edge function apps-lookup-read), mais a regra da rota admin.

import type {
  LookupDependencies,
  OfferProductInput,
  ProductGrantInput,
} from "./lookup.d.mts";

export declare const APPS_LOOKUP_CORE_PATH: "/functions/v1/apps-lookup-read";
export declare const APPS_LOOKUP_TIMEOUT_MS: number;
export declare const APPS_LOOKUP_MAX_RESPONSE_BYTES: number;
export declare const CORE_SUBJECT_SENTINEL: "ngv-core-subject";

export declare class AppsLookupCoreError extends Error {
  code: string;
  constructor(code: string, message?: string);
}

export interface AppsLookupConfigInput {
  url?: string | null;
  writerKey?: string | null;
  hostAllowlist?: string | string[] | null;
  timeoutMs?: number | null;
}

export interface AppsLookupConfig {
  url: string;
  writerKey: string;
  hostAllowlist: string | string[];
  timeoutMs: number;
}

export interface CoreLookupBody {
  resolved: boolean;
  access: Record<string, unknown>[];
  purchases: Record<string, unknown>[];
  products: Record<string, unknown>[];
}

export declare function resolveAppsLookupConfig(options?: AppsLookupConfigInput): AppsLookupConfig;

export declare function validateAppsLookupUrl(
  raw: unknown,
  allowlistedHosts: string | string[] | null | undefined,
): URL;

export declare function parseCoreLookupBody(text: string): CoreLookupBody;

export declare function offerProductInputs(
  products: Record<string, unknown>[],
  purchases: Record<string, unknown>[],
): OfferProductInput[];

export type CoreFinders = Required<
  Pick<
    LookupDependencies,
    | "findUserIdByEmail"
    | "findPurchasesByEmail"
    | "findOfferProducts"
    | "findActiveProductGrantsByEmail"
    | "findUserAccessByUserId"
  >
>;

export declare function criarFindersDoCore(
  options?: AppsLookupConfigInput & { fetch?: typeof globalThis.fetch },
): CoreFinders;

export interface AppsLookupRouteResult {
  status: number;
  body: Record<string, unknown>;
}

export declare function handleAppsLookupRequest(options?: {
  authHeader?: string | null;
  email?: string | null;
  secret?: string | null;
  finders?: Partial<CoreFinders>;
  config?: AppsLookupConfigInput;
  fetch?: typeof globalThis.fetch;
}): Promise<AppsLookupRouteResult>;

export type { OfferProductInput, ProductGrantInput };
