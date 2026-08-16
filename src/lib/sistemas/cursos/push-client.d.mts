// Declaração de tipos pro adapter .mjs (mesma convenção .d.mts ao lado de .mjs que o TS
// resolve sob "moduleResolution": "bundler" — ver spy/estado-client.d.mts,
// quiz/analytics-client.d.mts, mesmo motivo: sem isso o TS larga `kind` pra `string`
// (widened), quebrando a união discriminada que os componentes de
// src/components/sistemas/cursos/ dependem pra estreitar o tipo).

export declare const CURSOS_PUSH_PATH: "/api/admin/push";
export declare const CURSOS_PUSH_SEGMENT_PRESETS: readonly ["total", "students", "leads"];

export declare class CursosModulePushError extends Error {
  code: string;
  constructor(code: string);
}

export interface CursosPushButtonInput {
  id?: string;
  text: string;
  url?: string | null;
}

export interface CursosPushButton {
  id: string;
  text: string;
  url?: string;
}

export type CursosPushSegment = string | string[];

export interface CursosPushInput {
  title: string;
  message?: string | null;
  imageUrl?: string | null;
  launchUrl: string;
  buttons?: CursosPushButtonInput[] | null;
  segment?: CursosPushSegment | null;
  scheduleTime?: string | null;
}

export interface CursosPushValidatedPayload {
  title: string;
  message: string;
  imageUrl?: string;
  launchUrl: string;
  buttons: CursosPushButton[];
  segment: CursosPushSegment;
  scheduleTime?: string;
}

export interface CursosPushResponseData {
  id: string;
  recipients: number | null;
}

export type CursosPushResult =
  | { kind: "not_configured"; reason: string; sentAt: null; data: null }
  | { kind: "error"; code: string; sentAt: null; data: null }
  | { kind: "success"; sentAt: string; data: CursosPushResponseData };

export declare function validateCursosPushInput(input: unknown): CursosPushValidatedPayload;

export declare function sendCursosPushCampaign(
  input: CursosPushInput,
  options?: {
    origin?: string;
    secret?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<CursosPushResult>;
