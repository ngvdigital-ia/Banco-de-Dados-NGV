"use server";

import { db } from "@/db";
import { offerTracking } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getOffers(filters?: {
  language?: string;
  validation?: string;
  copywriter?: string;
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

  const result = await db
    .select()
    .from(offerTracking)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(offerTracking.createdAt));

  return result;
}

export async function updateOfferField(
  id: number,
  field: string,
  value: string | number | null
) {
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
    "adsRejectedCount",
    "editorStatus",
    "campaignsActive",
    "validation",
    "preScale",
    "scale",
    "productCreated",
    "productApproved",
    "siteCreated",
    "observations",
  ]);

  if (!allowedFields.has(field)) {
    throw new Error(`Campo desconhecido: ${field}`);
  }

  await db
    .update(offerTracking)
    .set({ [field]: value, updatedAt: new Date() })
    .where(eq(offerTracking.id, id));

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

export async function createOffer() {
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
  await db.delete(offerTracking).where(eq(offerTracking.id, id));
  revalidatePath("/offers");
}

export async function importOffers(rows: Record<string, unknown>[]) {
  let imported = 0;

  for (const row of rows) {
    try {
      const getString = (key: string) => {
        const val = row[key];
        return typeof val === "string" ? val.trim() : "";
      };
      const getNumber = (key: string) => {
        const val = row[key];
        if (typeof val === "number") return val;
        if (typeof val === "string") {
          const n = parseInt(val.trim(), 10);
          return isNaN(n) ? 0 : n;
        }
        return 0;
      };

      // Parse adsCopyByPerson from "Ads copy (ROBERT )" and "Ads copy ( GABRIEL )"
      const adsCopyByPerson: Record<string, number> = {};
      const robertVal = getNumber("Ads copy (ROBERT )");
      const gabrielVal = getNumber("Ads copy ( GABRIEL )");
      if (robertVal) adsCopyByPerson.ROBERT = robertVal;
      if (gabrielVal) adsCopyByPerson.GABRIEL = gabrielVal;

      // Parse editorStatus from "Edicao Camile", "Edicao Luis", etc.
      const editorStatus: Record<string, string> = {};
      const camile = getString("Edição Camile") || getString("Edicao Camile");
      const luis = getString("Edição Luis") || getString("Edicao Luis");
      const victor = getString("Edição Victor") || getString("Edicao Victor");
      const malu = getString("Edição Malu") || getString("Edicao Malu");
      if (camile) editorStatus.Camile = camile;
      if (luis) editorStatus.Luis = luis;
      if (victor) editorStatus.Victor = victor;
      if (malu) editorStatus.Malu = malu;

      await db.insert(offerTracking).values({
        name: getString("Oferta") || "Sem nome",
        copyVsl: getString("Copy da VSL") || null,
        copyAds: getString("Copy ADS") || null,
        editorAds: getString("Editor dos Ads") || null,
        editorVsl: getString("Editor da VSL") || null,
        ticket: getString("Ticket") || null,
        language: getString("Língua") || "EN",
        copyVslStatus: getString("Copy VSL") || "NAO",
        copyCriativosStatus: getString("Copy criativos") || "NAO",
        vslInVturb: getString("VSL no Vturb") || "NAO",
        adsCopyByPerson:
          Object.keys(adsCopyByPerson).length > 0 ? adsCopyByPerson : null,
        adsEditedCount: getNumber("ADS Editados (qtd)"),
        adsRejectedCount: getNumber("ADS Rejeitados (qtd)"),
        editorStatus:
          Object.keys(editorStatus).length > 0 ? editorStatus : null,
        campaignsActive: getString("Campanhas ativas") || "NAO",
        validation: getString("Validação da oferta") || "EM ANDAMENTO",
        preScale: getString("Pré escala") || "NAO",
        scale: getString("Escala") || "NAO",
        productCreated: getString("Produto criado") || "NAO",
        productApproved: getString("Produto aprovado na plataforma") || "NAO",
        siteCreated: getString("Site criado") || "NAO",
        observations: getString("Observações") || null,
      });

      imported++;
    } catch (err) {
      console.error(`[ImportOffers] Error importing row:`, err);
    }
  }

  revalidatePath("/offers");
  return `${imported} oferta(s) importada(s) com sucesso!`;
}
