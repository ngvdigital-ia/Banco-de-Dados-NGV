"use server";

import { db } from "@/db";
import { abTests, abTestVariants } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getAbTests() {
  const tests = await db.select().from(abTests).orderBy(desc(abTests.createdAt));
  const results = [];
  for (const test of tests) {
    const variants = await db
      .select()
      .from(abTestVariants)
      .where(eq(abTestVariants.abTestId, test.id));
    results.push({ ...test, variants });
  }
  return results;
}

export async function createAbTest(data: {
  name: string;
  entityType: string;
  startDate: string;
  variants: { name: string; description: string }[];
}) {
  const [test] = await db
    .insert(abTests)
    .values({
      name: data.name,
      entityType: data.entityType,
      startDate: new Date(data.startDate),
    })
    .returning({ id: abTests.id });

  for (const v of data.variants) {
    await db.insert(abTestVariants).values({
      abTestId: test.id,
      variantName: v.name,
      description: v.description,
    });
  }

  revalidatePath("/ab-tests");
}

export async function completeAbTest(id: number, winnerId: number | null) {
  await db
    .update(abTests)
    .set({ status: "completed", winnerId, endDate: new Date() })
    .where(eq(abTests.id, id));
  revalidatePath("/ab-tests");
}

export async function deleteAbTest(id: number) {
  await db.delete(abTestVariants).where(eq(abTestVariants.abTestId, id));
  await db.delete(abTests).where(eq(abTests.id, id));
  revalidatePath("/ab-tests");
}

export async function updateVariantMetrics(
  variantId: number,
  metrics: Record<string, unknown>
) {
  await db
    .update(abTestVariants)
    .set({ metricsJson: metrics })
    .where(eq(abTestVariants.id, variantId));
  revalidatePath("/ab-tests");
}
