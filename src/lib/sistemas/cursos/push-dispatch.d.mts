import type { CursosPushInput, CursosPushResult } from "./push-client.d.mts";

export interface DispatchCursosPushCampaignWithAuditParams {
  actorClerkId: string;
  actorEmail: string;
  input: CursosPushInput;
  logActionImpl: (params: {
    actorClerkId: string;
    actorEmail: string;
    module: "cursos";
    action: string;
    targetRef: string | null;
    result: "success" | "failure";
    resultDetail: string | null;
    payload: unknown;
  }) => Promise<void>;
  sendImpl?: (input: CursosPushInput) => Promise<CursosPushResult>;
}

export declare function dispatchCursosPushCampaignWithAudit(
  params: DispatchCursosPushCampaignWithAuditParams,
): Promise<CursosPushResult>;
