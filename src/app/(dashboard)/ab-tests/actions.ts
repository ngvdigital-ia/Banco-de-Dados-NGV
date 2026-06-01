"use server";

import { db } from "@/db";
import { abTests, abTestVariants } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getAbTests() {
  try {
    const tests = await db
      .select()
      .from(abTests)
      .orderBy(desc(abTests.createdAt))
      .limit(100);

    if (tests.length === 0) return [];

    const allVariants = await db
      .select()
      .from(abTestVariants)
      .where(inArray(abTestVariants.abTestId, tests.map((t) => t.id)));

    const variantsByTestId = new Map<number, typeof allVariants>();
    for (const v of allVariants) {
      const list = variantsByTestId.get(v.abTestId) ?? [];
      list.push(v);
      variantsByTestId.set(v.abTestId, list);
    }

    return tests.map((test) => ({
      ...test,
      variants: variantsByTestId.get(test.id) ?? [],
    }));
  } catch (err) {
    console.error("[getAbTests] Error:", err);
    throw err;
  }
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
