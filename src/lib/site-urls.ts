import { z } from "zod";

// Hard cap pra proteger UI e DB. ~50 links por oferta é mais que suficiente.
export const MAX_LINKS = 50;

export type CustomLink = { label: string; url: string };

export type SiteUrls = {
  domain?: string;
  vsl?: string;
  whites?: string[];
  quiz?: string;
  custom?: CustomLink[];
};

const httpUrl = z
  .string()
  .trim()
  .min(1)
  .refine((s) => isValidHttpUrl(s), "URL deve começar com http:// ou https://");

const customLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: httpUrl,
});

export const siteUrlsSchema: z.ZodType<SiteUrls> = z
  .object({
    domain: z.string().trim().max(120).optional(),
    vsl: httpUrl.optional(),
    whites: z.array(httpUrl).max(MAX_LINKS).optional(),
    quiz: httpUrl.optional(),
    custom: z.array(customLinkSchema).max(MAX_LINKS).optional(),
  })
  .refine((v) => totalLinks(v) <= MAX_LINKS, `Máximo de ${MAX_LINKS} links por oferta`);

export function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Normaliza uma URL: garante https://, lowercase no host, sem trailing slash, path preservado.
// Retorna a string original se for inválida (validação ocorre antes via schema).
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return trimmed;
    u.host = u.host.toLowerCase();
    let out = u.toString();
    // Tira trailing slash exceto quando é só o host (https://x.com/)
    if (out.endsWith("/") && u.pathname !== "/") out = out.slice(0, -1);
    return out;
  } catch {
    return trimmed;
  }
}

// Normaliza pra dedup: igual ao normalizeUrl mas também remove trailing / mesmo no host raiz.
function dedupKey(url: string): string {
  return normalizeUrl(url).replace(/\/$/, "").toLowerCase();
}

export function dedupeUrls(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of arr) {
    const k = dedupKey(u);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(normalizeUrl(u));
    }
  }
  return out;
}

export function dedupeCustom(arr: CustomLink[]): CustomLink[] {
  const seen = new Set<string>();
  const out: CustomLink[] = [];
  for (const c of arr) {
    const k = dedupKey(c.url);
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ label: c.label.trim(), url: normalizeUrl(c.url) });
    }
  }
  return out;
}

// Aplica normalização + dedup em todas as listas. Singletons (vsl, quiz) só normaliza.
export function normalizeSiteUrls(urls: SiteUrls): SiteUrls {
  const out: SiteUrls = {};
  if (urls.domain) out.domain = urls.domain.trim().toLowerCase();
  if (urls.vsl) out.vsl = normalizeUrl(urls.vsl);
  if (urls.quiz) out.quiz = normalizeUrl(urls.quiz);
  if (urls.whites?.length) out.whites = dedupeUrls(urls.whites.filter(Boolean));
  if (urls.custom?.length) out.custom = dedupeCustom(urls.custom.filter((c) => c?.url && c?.label));
  return out;
}

// Mescla dois SiteUrls (existing + incoming).
// vsl/quiz/domain: substituem se vierem em incoming, senão preservam existing.
// whites/custom: união com dedup por URL normalizada.
export function mergeSiteUrls(existing: SiteUrls | null, incoming: SiteUrls): SiteUrls {
  const base = existing ?? {};
  const out: SiteUrls = {
    domain: incoming.domain ?? base.domain,
    vsl: incoming.vsl ?? base.vsl,
    quiz: incoming.quiz ?? base.quiz,
  };
  if (incoming.whites?.length || base.whites?.length) {
    out.whites = dedupeUrls([...(base.whites ?? []), ...(incoming.whites ?? [])]);
  }
  if (incoming.custom?.length || base.custom?.length) {
    out.custom = dedupeCustom([...(base.custom ?? []), ...(incoming.custom ?? [])]);
  }
  return normalizeSiteUrls(out);
}

// Extrai host da VSL pra preencher domain automaticamente quando não vier.
export function deriveDomain(urls: SiteUrls): string | undefined {
  const ref = urls.vsl ?? urls.quiz ?? urls.whites?.[0] ?? urls.custom?.[0]?.url;
  if (!ref) return undefined;
  try {
    return new URL(ref.includes("://") ? ref : `https://${ref}`).host.toLowerCase();
  } catch {
    return undefined;
  }
}

export function vslOf(urls: SiteUrls | null): string | undefined {
  return urls?.vsl;
}

export function totalLinks(urls: SiteUrls | null | undefined): number {
  if (!urls) return 0;
  let n = 0;
  if (urls.vsl) n++;
  if (urls.quiz) n++;
  n += urls.whites?.length ?? 0;
  n += urls.custom?.length ?? 0;
  return n;
}

// Retorna a URL "principal" pra mostrar como link clicável na tabela:
// VSL primeiro, senão Quiz, senão primeiro white, senão primeiro custom.
export function primaryUrl(urls: SiteUrls | null | undefined): string | undefined {
  if (!urls) return undefined;
  return urls.vsl ?? urls.quiz ?? urls.whites?.[0] ?? urls.custom?.[0]?.url ?? undefined;
}
