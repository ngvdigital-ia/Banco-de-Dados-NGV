// Tipos locais da tela de composição de campanha de push (Cursos, Fase 4). Reexporta o
// que vem do adapter (.d.mts ao lado de push-client.mjs) em vez de duplicar a forma do
// payload — mesma convenção de src/components/sistemas/spy/types.ts.
export type {
  CursosPushButton,
  CursosPushButtonInput,
  CursosPushInput,
  CursosPushResponseData,
  CursosPushResult,
  CursosPushSegment,
  CursosPushValidatedPayload,
} from "@/lib/sistemas/cursos/push-client.d.mts";

export type CursosPushSegmentKey = "total" | "students" | "leads";

export interface CursosPushButtonFormState {
  id: string;
  text: string;
  url: string;
}

export interface CursosPushFormState {
  title: string;
  message: string;
  imageUrl: string;
  launchUrl: string;
  buttons: CursosPushButtonFormState[];
  segment: CursosPushSegmentKey;
  scheduleTime: string;
}
