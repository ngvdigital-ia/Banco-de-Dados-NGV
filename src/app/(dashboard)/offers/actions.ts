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
