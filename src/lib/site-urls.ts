import { z } from "zod";
import { isValidHttpUrl, MAX_LINKS, totalLinks } from "@/lib/site-urls-types";
import type { SiteUrls } from "@/lib/site-urls-types";

// Re-exporta todos os tipos e helpers puros de site-urls-types (sem Zod).
// Mantido para compatibilidade retroativa — server actions e API routes continuam
// importando daqui e recebem tanto os helpers quanto o siteUrlsSchema.
export {
  MAX_LINKS,
  type CustomLink,
  type SiteUrls,
  type SiteUrlsDelta,
  isValidHttpUrl,
  normalizeUrl,
  dedupeUrls,
  dedupeCustom,
  normalizeSiteUrls,
  mergeSiteUrls,
  deriveDomain,
  vslOf,
  totalLinks,
  primaryUrl,
  computeDelta,
  deltaSummary,
} from "@/lib/site-urls-types";

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
