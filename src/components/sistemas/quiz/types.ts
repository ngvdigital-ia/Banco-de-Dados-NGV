// Reexporta os tipos declarados em analytics-client.d.mts (sibling do adapter .mjs) —
// contrato vive num único lugar, este arquivo só aponta pra ele.
export type { QuizModuleAnalyticsData, QuizModuleAnalyticsResult } from "@/lib/sistemas/quiz/analytics-client.mjs";
