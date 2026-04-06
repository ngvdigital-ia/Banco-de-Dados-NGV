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

      // Fuzzy key finder — matches column names with extra spaces
      const findKey = (search: string) => {
        const searchLower = search.toLowerCase().replace(/\s+/g, "").trim();
        return Object.keys(row).find((k) => {
          const kLower = k.toLowerCase().replace(/\s+/g, "").trim();
          return kLower === searchLower || kLower.includes(searchLower);
        });
      };
      const getStringFuzzy = (search: string) => {
        const key = findKey(search);
        return key ? getString(key) : "";
      };
      const getNumberFuzzy = (search: string) => {
        const key = findKey(search);
        return key ? getNumber(key) : 0;
      };

      // Parse adsCopyByPerson from "Ads copy (ROBERT)" and "Ads copy (GABRIEL)"
      const adsCopyByPerson: Record<string, number> = {};
      const robertVal = getNumberFuzzy("ads copy (robert");
      const gabrielVal = getNumberFuzzy("ads copy (gabriel");
      if (robertVal) adsCopyByPerson.ROBERT = robertVal;
      if (gabrielVal) adsCopyByPerson.GABRIEL = gabrielVal;

      // Parse editorStatus from "Edição Camile", "Edição Luis", etc.
      const editorStatus: Record<string, string> = {};
      const camile = getStringFuzzy("camile");
      const luis = getStringFuzzy("luis");
      const victor = getStringFuzzy("victor");
      const malu = getStringFuzzy("malu");
      if (camile) editorStatus.Camile = camile;
      if (luis) editorStatus.Luis = luis;
      if (victor) editorStatus.Victor = victor;
      if (malu) editorStatus.Malu = malu;

      await db.insert(offerTracking).values({
        name: getStringFuzzy("oferta") || "Sem nome",
        copyVsl: getStringFuzzy("copy da vsl") || null,
        copyAds: getStringFuzzy("copy ads") || null,
        editorAds: getStringFuzzy("editor dos ads") || null,
        editorVsl: getStringFuzzy("editor da vsl") || null,
        ticket: getStringFuzzy("ticket") || null,
        language: getStringFuzzy("língua") || getStringFuzzy("lingua") || "EN",
        copyVslStatus: (() => {
          // "Copy VSL" is column 7 (status SIM/NAO), not "Copy da VSL" (column 2, person name)
          const key = Object.keys(row).find(k => {
            const clean = k.toLowerCase().replace(/\s+/g, "").trim();
            return clean === "copyvsl";
          });
          return key ? getString(key) : "NAO";
        })(),
        copyCriativosStatus: getStringFuzzy("copycriativos") || "NAO",
        vslInVturb: getStringFuzzy("vsl no vturb") || "NAO",
        adsCopyByPerson:
          Object.keys(adsCopyByPerson).length > 0 ? adsCopyByPerson : null,
        adsEditedCount: getNumberFuzzy("ads editados"),
        adsRejectedCount: getNumberFuzzy("ads rejeitados"),
        editorStatus:
          Object.keys(editorStatus).length > 0 ? editorStatus : null,
        campaignsActive: getStringFuzzy("campanhas") || "NAO",
        validation: getStringFuzzy("validação") || getStringFuzzy("validacao") || "EM ANDAMENTO",
        preScale: getStringFuzzy("pré escala") || getStringFuzzy("pre escala") || "NAO",
        scale: getStringFuzzy("escala") || "NAO",
        productCreated: getStringFuzzy("produto criado") || "NAO",
        productApproved: getStringFuzzy("produto aprovado") || "NAO",
        siteCreated: getStringFuzzy("site criado") || "NAO",
        observations: getStringFuzzy("observ") || null,
      });

      imported++;
    } catch (err) {
      console.error(`[ImportOffers] Error importing row:`, err);
    }
  }

  revalidatePath("/offers");
  return `${imported} oferta(s) importada(s) com sucesso!`;
}
