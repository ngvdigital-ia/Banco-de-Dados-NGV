export declare const QUIZ_DASHBOARD_PROJECTS_PATH: "/api/dashboard/projects";

export declare class QuizDashboardProjectsError extends Error {
  code: string;
  constructor(code: string);
}

export interface QuizDashboardProject {
  projectId: string;
  name: string;
  funnelId: string;
  offerId: string | null;
  bancoOfferTrackingId: number | null;
  testPilot: boolean;
  state: string;
  finalUrl: string | null;
  origin: string | null;
  deployedAt: string | null;
  firstEventAt: string | null;
}

export interface QuizProvisionedProject {
  projectId: string;
  name: string;
  funnelId: string;
  offerId: string;
  bancoOfferTrackingId: number | null;
  testPilot: boolean;
  /** Só existe no retorno de provisionamento para operador autorizado. */
  publicKey: string;
  publicKeyPrefix: string;
  state: string;
  finalUrl: string;
  allowedOrigins: string[];
  pageId: string;
  steps: Array<{ id: string; label: string; index: number }>;
}

export interface QuizTrackerInstallation {
  trackerUrl: string;
  trackUrl: string;
  attributes: { projectId: string; funnelId: string; pageId: string; endpoint: string; publicKey: string };
}

export type QuizDashboardProjectsResult<TData> =
  | { kind: "not_configured"; reason: string; receivedAt: null; data: null }
  | { kind: "error"; code: string; receivedAt: null; data: null }
  | { kind: "success"; receivedAt: string; data: TData };

export interface QuizDashboardProjectsOptions {
  username?: string;
  password?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface QuizProvisionInput {
  name: string;
  finalUrl: string;
  bancoOfferTrackingId?: number | null;
  /** Orientação de sessão da UI; não é enviada ao upstream. */
  format?: "quiz" | "vsl" | "presell";
}

export declare function parseQuizDashboardProjectsPayload(input: unknown): {
  provisioningEnabled: boolean;
  projects: QuizDashboardProject[];
};

export declare function parseQuizDashboardProvisionPayload(input: unknown): {
  project: QuizProvisionedProject;
  installation: QuizTrackerInstallation;
};

export declare function deriveQuizProvisionPayload(input: QuizProvisionInput): Record<string, unknown>;

export declare function fetchQuizDashboardProjects(
  options?: QuizDashboardProjectsOptions,
): Promise<QuizDashboardProjectsResult<{ provisioningEnabled: boolean; projects: QuizDashboardProject[] }>>;

export declare function provisionQuizDashboardProject(
  input: QuizProvisionInput,
  options?: QuizDashboardProjectsOptions,
): Promise<QuizDashboardProjectsResult<{ project: QuizProvisionedProject; installation: QuizTrackerInstallation }>>;
