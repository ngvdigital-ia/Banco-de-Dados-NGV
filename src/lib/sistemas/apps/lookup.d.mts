// Declaração de tipos pro módulo lookup.mjs de Apps Admin (Banco NGV Frente B).

export type ProductState = "comprado" | "liberado_manual" | "bloqueado";

export interface AccessRow {
  offer_slug: string;
  status: string;
  purchase_platform: string | null;
  purchase_id: string | null;
  created_at: string | null;
  activated_at: string | null;
}

export interface PurchaseRow {
  product_id: string | null;
  product_name: string | null;
  amount_cents: number | null;
  currency: string;
  event: string | null;
  order_id: string | null;
  catalog_group: string | null;
  created_at: string;
}

export interface ProductStateRow {
  offer_slug: string;
  product_key: string;
  title: string;
  state: ProductState;
}

export interface OfferProductInput {
  offer_slug: string;
  product_key: string;
  title: string;
  external_product_id?: string | null;
}

export interface ProductGrantInput {
  offer_slug: string;
  product_key: string;
  status?: string;
}

export interface LookupSuccessResult {
  ok: true;
  status: 200;
  access: AccessRow[];
  purchases: PurchaseRow[];
  products: ProductStateRow[];
}

export interface LookupErrorResult {
  ok: false;
  status: 400 | 500;
  error: string;
  code: string;
}

export type LookupResult = LookupSuccessResult | LookupErrorResult;

export interface LookupDependencies {
  email?: string | null;
  findUserIdByEmail?: (emailLower: string) => Promise<string | null>;
  findPurchasesByEmail?: (emailLower: string) => Promise<Record<string, unknown>[]>;
  findOfferProducts?: () => Promise<OfferProductInput[]>;
  findActiveProductGrantsByEmail?: (emailLower: string) => Promise<ProductGrantInput[]>;
  findUserAccessByUserId?: (userId: string) => Promise<Record<string, unknown>[]>;
}

export declare const APPS_LOOKUP_CODES: {
  readonly MISSING_EMAIL: "MISSING_EMAIL";
  readonly INVALID_EMAIL: "INVALID_EMAIL";
  readonly USER_LOOKUP_FAILED: "USER_LOOKUP_FAILED";
  readonly PURCHASES_LOOKUP_FAILED: "PURCHASES_LOOKUP_FAILED";
  readonly PRODUCTS_LOOKUP_FAILED: "PRODUCTS_LOOKUP_FAILED";
  readonly GRANTS_LOOKUP_FAILED: "GRANTS_LOOKUP_FAILED";
  readonly ACCESS_LOOKUP_FAILED: "ACCESS_LOOKUP_FAILED";
};

export declare function validateEmail(rawEmail: unknown): {
  ok: boolean;
  status: number;
  email: string;
  error?: string;
  code?: string;
};

export declare function parseEmail(rawEmail: unknown): {
  ok: boolean;
  status: number;
  email: string;
  error?: string;
  code?: string;
};

export declare function projectAccessRow(row: unknown): AccessRow | null;
export declare function projectPurchaseRow(row: unknown): PurchaseRow | null;

export declare function computeProductStates(params?: {
  offerProducts?: OfferProductInput[];
  grants?: ProductGrantInput[];
  purchases?: Array<{ product_id?: string | null }>;
}): ProductStateRow[];

export declare function lookupAppsCustomer(options?: LookupDependencies): Promise<LookupResult>;
export declare function lookupAppsAccess(options?: LookupDependencies): Promise<LookupResult>;
