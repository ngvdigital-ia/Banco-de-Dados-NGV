"use server";

import { db } from "@/db";
import { metricsSnapshots, projects, creatives, campaigns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const metricsSchema = z.object({
  date: z.string(),
  entityType: z.string(),
  entityId: z.number(),
  source: z.enum(["manual", "utmify", "meta_api", "tiktok_api"]).default("manual"),
  impressions: z.number().nullable().optional(),
  clicks: z.number().nullable().optional(),
  spend: z.string().nullable().optional(),
  pageVisits: z.number().nullable().optional(),
  playRate: z.string().nullable().optional(),
  buttonClickRate: z.string().nullable().optional(),
  checkoutVisits: z.number().nullable().optional(),
  conversionRate: z.string().nullable().optional(),
  avgTicket: z.string().nullable().optional(),
  revenue: z.string().nullable().optional(),
  cpa: z.string().nullable().optional(),
  roas: z.string().nullable().optional(),
  ltv: z.string().nullable().optional(),
  videoRetentionJson: z
    .object({
      retention1min: z.string().nullable().optional(),
      retention5min: z.string().nullable().optional(),
      retentionPriceReveal: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type MetricsFormData = z.infer<typeof metricsSchema>;

export async function createMetricsSnapshot(data: MetricsFormData) {
  const parsed = metricsSchema.parse(data);
  await db.insert(metricsSnapshots).values({
    date: new Date(parsed.date),
    entityType: parsed.entityType,
    entityId: parsed.entityId,
    source: parsed.source,
    impressions: parsed.impressions ?? null,
    clicks: parsed.clicks ?? null,
    spend: parsed.spend ?? null,
    pageVisits: parsed.pageVisits ?? null,
    playRate: parsed.playRate ?? null,
    buttonClickRate: parsed.buttonClickRate ?? null,
    checkoutVisits: parsed.checkoutVisits ?? null,
    conversionRate: parsed.conversionRate ?? null,
    avgTicket: parsed.avgTicket ?? null,
    revenue: parsed.revenue ?? null,
    cpa: parsed.cpa ?? null,
    roas: parsed.roas ?? null,
    ltv: parsed.ltv ?? null,
    videoRetentionJson: parsed.videoRetentionJson ?? null,
  });
  revalidatePath("/metrics");
  revalidatePath("/");
}

export async function getMetricsForProject(projectId: number) {
  return db
    .select()
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.entityId, projectId))
    .orderBy(desc(metricsSnapshots.date))
    .limit(30);
}

export async function getAllProjects() {
  return db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(projects.name);
}

export async function getCreativesForProject(projectId: number) {
  return db
    .select({ id: creatives.id, format: creatives.format, platform: creatives.platform, status: creatives.status })
    .from(creatives)
    .where(eq(creatives.projectId, projectId))
    .orderBy(creatives.createdAt);
}

export async function getCampaignsForProject(projectId: number) {
  return db
    .select({ id: campaigns.id, name: campaigns.name, platform: campaigns.platform, status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.projectId, projectId))
    .orderBy(campaigns.createdAt);
}
