// Declaração de tipos pro adapter .mjs (mesma convenção .d.mts ao lado de .mjs que o
// TS resolve sob "moduleResolution": "bundler"). Necessário aqui porque o TS, ao inferir
// o retorno de analytics-client.mjs sem anotação, larga o campo `kind` pra `string`
// (widened) — isso quebra a união discriminada (`result.kind === "success"`) que os
// componentes de src/components/sistemas/quiz/ dependem pra estreitar o tipo. Os demais
// adapters .mjs de src/lib/operacao/ contornam isso evitando `Extract<>`/narrowing por
// `kind` (usam `"code" in summary`); aqui preferimos tipos explícitos e corretos.

export declare const QUIZ_ANALYTICS_PATH: "/api/analytics";
export declare const QUIZ_ANALYTICS_ORIGIN: "https://quiz-analytics-phi.vercel.app";

export declare class QuizModuleAnalyticsError extends Error {
  code: string;
  constructor(code: string);
}

export interface QuizFunnelStep {
  id: string;
  label: string;
  count: number;
  overallRate: number;
  prevPassRate: number;
  prevDropRate: number;
  prevDropCount: number;
}

export interface QuizAnswerOption {
  label: string;
  count: number;
  pct: number;
}

export interface QuizResponseQuestion {
  id: string;
  label: string;
  stageNumber: number | null;
  stageLabel: string;
  multi: boolean;
  totalSessions: number;
  answers: QuizAnswerOption[];
}

export interface QuizUtmCampaign {
  campaign: string;
  sessions: number;
}

export interface QuizRecentEvent {
  eventName: string;
  screenId: string | null;
  label: string | null;
  createdAt: string;
  sessionShort: string;
  value: unknown;
}

export interface QuizJourneyPage {
  pageId: string;
  count: number;
}

export interface QuizJourneys {
  summary: { totalJourneys: number; crossPageJourneys: number };
  pages: QuizJourneyPage[];
}

export interface QuizAnalyticsMetadata {
  hasQuizAnswers: boolean;
  quizAnswersCount: number;
}

export interface QuizModuleAnalyticsData {
  generatedAt: string;
  filter: { from: string | null; to: string | null; projectId: string; funnelId: string };
  summary: { totalSessions: number; started: number; checkoutClicks: number; checkoutRate: number };
  funnel: QuizFunnelStep[];
  responses: QuizResponseQuestion[];
  utmCampaigns: QuizUtmCampaign[];
  recentEvents: QuizRecentEvent[];
  journeys: QuizJourneys;
  metadata: QuizAnalyticsMetadata;
}

export type QuizModuleAnalyticsResult =
  | { kind: "not_configured"; reason: string; generatedAt: null; data: null }
  | { kind: "error"; code: string; generatedAt: null; data: null }
  | { kind: "success"; generatedAt: string; data: QuizModuleAnalyticsData };

export declare function parseQuizModuleAnalyticsPayload(body: unknown): QuizModuleAnalyticsData;

export declare function fetchQuizModuleAnalytics(
  filters?: { projectId?: string; funnelId?: string; from?: string; to?: string },
  options?: {
    origin?: string;
    username?: string;
    password?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<QuizModuleAnalyticsResult>;
