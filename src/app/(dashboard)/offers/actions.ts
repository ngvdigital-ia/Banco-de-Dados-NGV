"use server";

import { db } from "@/db";
import { offerTracking } from "@/db/schema";
import { eq, desc, and, gte, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin-auth";
import { logChange } from "@/lib/changelog";
import {
  type SiteUrls,
  siteUrlsSchema,
  normalizeSiteUrls,
  deriveDomain,
  vslOf,
  totalLinks,
} from "@/lib/site-urls";

export async function getOffers(filters?: {
  language?: string;
  validation?: string;
  copywriter?: string;
  monthFrom?: string; // "2026-03" format
  monthTo?: string;   // "2026-04" format
}) {
  const conditions = [];

  if (filters?.language) {
    conditions.push(eq(offerTracking.language, filters.language));
  }
  if (filters?.validation) {
    conditions.push(eq(offerTracking.validation, filters.validation));
  }
  if (filters?.copywriter) {
    conditions.push(eq(offerTracking.copyVsl, filters.copywriter));
  }
  if (filters?.monthFrom) {
    const [y, m] = filters.monthFrom.split("-").map(Number);
    conditions.push(gte(offerTracking.createdAt, new Date(y, m - 1, 1)));
  }
  if (filters?.monthTo) {
    const [y, m] = filters.monthTo.split("-").map(Number);
    // End of month: first day of next month
    conditions.push(lt(offerTracking.createdAt, new Date(y, m, 1)));
  }

  const result = await db
    .select()
    .from(offerTracking)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(offerTracking.createdAt))
    .limit(200);

  return result;
}

export async function getOfferFilterOptions() {
  const [languages, validations, copywriters] = await Promise.all([
    db
      .selectDistinct({ value: offerTracking.language })
      .from(offerTracking)
      .orderBy(offerTracking.language),
    db
      .selectDistinct({ value: offerTracking.validation })
      .from(offerTracking)
      .orderBy(offerTracking.validation),
    db
      .selectDistinct({ value: offerTracking.copyVsl })
      .from(offerTracking)
      .orderBy(offerTracking.copyVsl),
  ]);

  return {
    languages: languages.map((r) => r.value).filter((v): v is string => v !== null),
    validations: validations.map((r) => r.value).filter((v): v is string => v !== null),
    copywriters: copywriters.map((r) => r.value).filter((v): v is string => v !== null),
  };
}

export async function getOfferMonths() {
  const rows = await db
    .selectDistinct({
      month: sql<string>`to_char(${offerTracking.createdAt}, 'YYYY-MM')`,
    })
    .from(offerTracking)
    .orderBy(sql`to_char(${offerTracking.createdAt}, 'YYYY-MM') DESC`);

  return rows.map((r) => r.month);
}

export async function updateOfferField(
  id: number,
  field: string,
  value: string | number | null
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const allowedFields = new Set([
    "name",
    "copyVsl",
    "copyAds",
    "editorAds",
    "editorVsl",
    "ticket",
    "language",
    "copyVslStatus",
    "copyCriativosStatus",
    "vslInVturb",
    "adsCopyByPerson",
    "adsEditedCount",
    "adsEditedByPerson",
    "adsRejectedCount",
    "editorStatus",
    "campaignsActive",
    "validation",
    "preScale",
    "scale",
    "productCreated",
    "productApproved",
    "siteCreated",
    // siteUrl removido propositalmente — escrita passa por updateOfferSiteUrls
    // para manter siteUrls (jsonb) e siteUrl (text legacy) sincronizados.
    "gender",
    "adFormat",
    "observations",
  ]);

  if (!allowedFields.has(field)) {
    throw new Error(`Campo desconhecido: ${field}`);
  }

  // Captura valor antigo para changelog — tolerante a falha (não bloqueia o update)
  let oldValue: unknown = null;
  try {
    const [current] = await db
      .select()
      .from(offerTracking)
      .where(eq(offerTracking.id, id))
      .limit(1);
    oldValue = current ? (current as Record<string, unknown>)[field] ?? null : null;
  } catch {
    // Não bloqueia o update se a leitura prévia falhar
  }

  await db
    .update(offerTracking)
    .set({ [field]: value, updatedAt: new Date() })
    .where(eq(offerTracking.id, id));

  // Registro no changelog — falha silenciosa (não deve quebrar o update)
  try {
    await logChange("offer", id, "update", {
      [field]: { from: oldValue, to: value },
    });
  } catch (logErr) {
    console.error("[updateOfferField] logChange failed (non-fatal):", logErr);
  }

  // Keep adsEditedCount in sync with sum of adsEditedByPerson values
  if (field === "adsEditedByPerson") {
    let total = 0;
    try {
      const parsed =
        typeof value === "string" ? JSON.parse(value) : (value as unknown);
      if (parsed && typeof parsed === "object") {
        for (const v of Object.values(parsed as Record<string, unknown>)) {
          const n = typeof v === "number" ? v : parseInt(String(v), 10) || 0;
          total += n;
        }
      }
    } catch {
      total = 0;
    }
    await db
      .update(offerTracking)
      .set({ adsEditedCount: total, updatedAt: new Date() })
      .where(eq(offerTracking.id, id));
  }

  // Cascade status changes through the pipeline
  if (field === "campaignsActive" && String(value).toUpperCase() === "SIM") {
    await db
      .update(offerTracking)
      .set({ validation: "EM ANDAMENTO", updatedAt: new Date() })
      .where(eq(offerTracking.id, id));
  }
  if (field === "validation") {
    const upper = String(value).toUpperCase();
    if (upper === "SIM") {
      await db
        .update(offerTracking)
        .set({ preScale: "EM ANDAMENTO", updatedAt: new Date() })
        .where(eq(offerTracking.id, id));
    } else if (upper === "NAO" || upper === "NÃO DEU CERTO") {
      await db
        .update(offerTracking)
        .set({ preScale: "NAO", scale: "NAO", updatedAt: new Date() })
        .where(eq(offerTracking.id, id));
    }
  }
  if (field === "preScale") {
    const upper = String(value).toUpperCase();
    if (upper === "SIM") {
      await db
        .update(offerTracking)
        .set({ scale: "EM ANDAMENTO", updatedAt: new Date() })
        .where(eq(offerTracking.id, id));
    } else if (upper === "NAO") {
      await db
        .update(offerTracking)
        .set({ scale: "NAO", updatedAt: new Date() })
        .where(eq(offerTracking.id, id));
    }
  }

  revalidatePath("/offers");
}

// Atualiza siteUrls (jsonb estruturado) e sincroniza siteUrl (text legacy) com a VSL.
// É a ÚNICA forma de escrever esses campos — siteUrl saiu do allowlist de updateOfferField.
// Cascata: quando primeiro link é adicionado, marca siteCreated="SIM" automaticamente.
export async function updateOfferSiteUrls(
  id: number,
  value: SiteUrls,
): Promise<{ siteUrls: SiteUrls; siteUrl: string | null }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const parsed = siteUrlsSchema.parse(value);
  const normalized = normalizeSiteUrls(parsed);
  // Preenche domain automaticamente se não vier
  if (!normalized.domain) {
    const inferred = deriveDomain(normalized);
    if (inferred) normalized.domain = inferred;
  }
  const newVsl = vslOf(normalized) ?? null;
  const hadAnyLink = totalLinks(normalized) > 0;

  // Snapshot atual pra detectar transição de zero → um link e disparar cascata
  const [current] = await db
    .select({
      siteUrls: offerTracking.siteUrls,
      siteCreated: offerTracking.siteCreated,
    })
    .from(offerTracking)
    .where(eq(offerTracking.id, id));

  const wasEmpty = totalLinks((current?.siteUrls as SiteUrls | null) ?? null) === 0;

  await db
    .update(offerTracking)
    .set({
      siteUrls: normalized as unknown as object,
      siteUrl: newVsl,
      // Cascata: 0 → 1 link e siteCreated ainda NAO → vira SIM
      ...(hadAnyLink && wasEmpty && current?.siteCreated !== "SIM"
        ? { siteCreated: "SIM" }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(offerTracking.id, id));

  revalidatePath("/offers");
  return { siteUrls: normalized, siteUrl: newVsl };
}

export async function createOffer() {
  await requireAdmin();

  const [newOffer] = await db
    .insert(offerTracking)
    .values({
      name: "Nova Oferta",
    })
    .returning();

  revalidatePath("/offers");
  return newOffer;
}

export async function deleteOffer(id: number) {
  await requireAdmin();

  await db.delete(offerTracking).where(eq(offerTracking.id, id));
  revalidatePath("/offers");
}

export async function duplicateOffer(id: number): Promise<number> {
  await requireAdmin();

  const [original] = await db
    .select()
    .from(offerTracking)
    .where(eq(offerTracking.id, id))
    .limit(1);

  if (!original) {
    throw new Error(`Oferta ${id} não encontrada`);
  }

  const [newOffer] = await db
    .insert(offerTracking)
    .values({
      // Setup preservado
      name: `${original.name} (copia)`,
      copyVsl: original.copyVsl,
      copyAds: original.copyAds,
      editorAds: original.editorAds,
      editorVsl: original.editorVsl,
      language: original.language,
      ticket: original.ticket,
      adFormat: original.adFormat,
      gender: original.gender,
      observations: original.observations,
      // Status zerado
      copyVslStatus: "NAO",
      copyCriativosStatus: "NAO",
      validation: "NAO",
      preScale: "NAO",
      scale: "NAO",
      productCreated: "NAO",
      productApproved: "NAO",
      siteCreated: "NAO",
      siteUrls: null,
      siteUrl: null,
    })
    .returning({ id: offerTracking.id });

  revalidatePath("/offers");
  return newOffer.id;
}

export async function importOffers(rows: Record<string, unknown>[]) {
  await requireAdmin();

  let imported = 0;

  for (const row of rows) {
    try {
      // Get all keys and build index-based access
      const keys = Object.keys(row);
      const col = (idx: number) => {
        const val = row[keys[idx]];
        return typeof val === "string" ? val.trim() : "";
      };
      const colNum = (idx: number) => {
        const val = col(idx);
        const n = parseInt(val, 10);
        return isNaN(n) ? 0 : n;
      };

      // Column mapping by index (based on the spreadsheet order):
      // 0: Oferta
      // 1: Copy da VSL
      // 2: Copy ADS
      // 3: Editor dos Ads
      // 4: Editor da VSL
      // 5: Ticket
      // 6: Copy VSL (status)
      // 7: Copy criativos (status)
      // 8: VSL no Vturb
      // 9: Ads copy (ROBERT)
      // 10: ADS Editados (qtd)
      // 11: Ads copy (GABRIEL)
      // 12: Língua
      // 13: Edição Camile
      // 14: Edição Luis
      // 15: Edição Victor
      // 16: Edição Malu
      // 17: ADS Rejeitados (qtd)
      // 18: Campanhas ativas
      // 19: Validação da oferta
      // 20: Pré escala
      // 21: Escala
      // 22: Produto criado
      // 23: Produto aprovado na plataforma
      // 24: Site criado
      // 25: Observações

      const name = col(0);
      if (!name) continue;

      const adsCopyByPerson: Record<string, number> = {};
      const robertVal = colNum(9);
      const gabrielVal = colNum(11);
      if (robertVal) adsCopyByPerson.ROBERT = robertVal;
      if (gabrielVal) adsCopyByPerson.GABRIEL = gabrielVal;

      const editorStatus: Record<string, string> = {};
      const camile = col(13);
      const luis = col(14);
      const victor = col(15);
      const malu = col(16);
      if (camile) editorStatus.Camile = camile;
      if (luis) editorStatus.Luis = luis;
      if (victor) editorStatus.Victor = victor;
      if (malu) editorStatus.Malu = malu;

      await db.insert(offerTracking).values({
        name,
        copyVsl: col(1) || null,
        copyAds: col(2) || null,
        editorAds: col(3) || null,
        editorVsl: col(4) || null,
        ticket: col(5) || null,
        copyVslStatus: col(6) || "NAO",
        copyCriativosStatus: col(7) || "NAO",
        vslInVturb: col(8) || "NAO",
        adsCopyByPerson: Object.keys(adsCopyByPerson).length > 0 ? adsCopyByPerson : null,
        adsEditedCount: colNum(10),
        adsRejectedCount: colNum(17),
        language: col(12) || "EN",
        editorStatus: Object.keys(editorStatus).length > 0 ? editorStatus : null,
        campaignsActive: col(18) || "NAO",
        validation: col(19) || "EM ANDAMENTO",
        preScale: col(20) || "NAO",
        scale: col(21) || "NAO",
        productCreated: col(22) || "NAO",
        productApproved: col(23) || "NAO",
        siteCreated: col(24) || "NAO",
        observations: col(25) || null,
      });

      imported++;
    } catch (err) {
      console.error(`[ImportOffers] Error importing row:`, err);
    }
  }

  revalidatePath("/offers");
  return `${imported} oferta(s) importada(s) com sucesso!`;
}
