import { getFilterOptions } from "../actions";
import { ComparePageClient } from "./compare-client";

// Server Component wrapper: busca filterOptions 1x no servidor (sem re-fetch no client)
// e passa como prop pro inner client que gerencia interatividade (padrao identico ao team/page.tsx)
export default async function ComparePage() {
  const filterOptions = await getFilterOptions();
  return <ComparePageClient filterOptions={filterOptions} />;
}
