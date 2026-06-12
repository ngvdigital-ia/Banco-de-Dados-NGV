"use server";

import { db } from "@/db";
import { offerTracking, teamMembers } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export interface SearchIndex {
  offers: { id: number; name: string }[];
  members: { id: number; name: string }[];
}

export async function getSearchIndex(): Promise<SearchIndex> {
  const [offers, members] = await Promise.all([
    db
      .select({ id: offerTracking.id, name: offerTracking.name })
      .from(offerTracking)
      .orderBy(asc(offerTracking.name))
      .limit(500),
    db
      .select({ id: teamMembers.id, name: teamMembers.name })
      .from(teamMembers)
      .where(eq(teamMembers.active, true)),
  ]);

  return { offers, members };
}
