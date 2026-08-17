import type { SiteUrls } from "../site-urls-types";

/** Colunas de offer_tracking que a rota de leitura seleciona (allowlist — sem campo de pessoa). */
export interface OfferLookupRow {
  id: number;
  name: string;
  language: string | null;
  ticket: string | null;
  gender: string | null;
  adFormat: string | null;
  copyVslStatus: string | null;
  copyCriativosStatus: string | null;
  vslInVturb: string | null;
  campaignsActive: string | null;
  validation: string | null;
  preScale: string | null;
  scale: string | null;
  productCreated: string | null;
  productApproved: string | null;
  siteCreated: string | null;
  adsEditedCount: number | null;
  adsRejectedCount: number | null;
  siteUrls: unknown;
  siteUrl: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}

export interface OfferLookupProjection {
  id: number;
  name: string;
  language: string | null;
  ticket: string | null;
  gender: string | null;
  adFormat: string | null;
  status: {
    copyVsl: string | null;
    copyCriativos: string | null;
    vslInVturb: string | null;
    campaignsActive: string | null;
    validation: string | null;
    preScale: string | null;
    scale: string | null;
    productCreated: string | null;
    productApproved: string | null;
    siteCreated: string | null;
  };
  ads: { editedCount: number; rejectedCount: number };
  hasSiteUrls: boolean;
  domain: string | null;
  siteUrls: SiteUrls | null;
  siteUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OfferLookupCandidate {
  id: number;
  name: string;
  language: string | null;
  validation: string | null;
  domain: string | null;
  createdAt: string | null;
}

export type OfferLookupIdentifier =
  | { kind: "id"; id: number }
  | { kind: "name"; name: string }
  | { kind: "error"; status: number; body: Record<string, unknown> };

export interface OfferLookupResult {
  status: number;
  body: Record<string, unknown>;
}

export interface LookupOfferParams {
  authHeader: string | null;
  cronSecret: string | undefined;
  params: { id?: string | null; name?: string | null };
  findById: (id: number) => Promise<OfferLookupRow | null | undefined>;
  findByName: (name: string) => Promise<OfferLookupRow[]>;
}

export declare const OFFER_LOOKUP_CODES: Readonly<{
  UNAUTHORIZED: "UNAUTHORIZED";
  MISSING_IDENTIFIER: "MISSING_IDENTIFIER";
  INVALID_ID: "INVALID_ID";
  INVALID_NAME: "INVALID_NAME";
  OFFER_NOT_FOUND: "OFFER_NOT_FOUND";
  OFFER_NAME_AMBIGUOUS: "OFFER_NAME_AMBIGUOUS";
}>;
export declare const MAX_CANDIDATES: number;
export declare const MAX_NAME_LENGTH: number;

/** Reexportado de ../auth-bearer.mjs — a regra mora lá, aqui é só compatibilidade de import. */
export { isAuthorizedBearer } from "../auth-bearer.mjs";
export declare function parseIdentifier(params: {
  id?: string | null;
  name?: string | null;
}): OfferLookupIdentifier;
export declare function projectOffer(row: OfferLookupRow): OfferLookupProjection;
export declare function projectCandidate(row: OfferLookupRow): OfferLookupCandidate;
export declare function lookupOffer(params: LookupOfferParams): Promise<OfferLookupResult>;
