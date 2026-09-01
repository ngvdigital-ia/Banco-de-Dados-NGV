export interface SpyDispatchActor {
  id: string;
  email: string;
}

export interface DispatchSpyMutationWithAuditParams<TResult extends { kind: string }> {
  action: string;
  mutationImpl: (actor: SpyDispatchActor) => Promise<TResult>;
  requireMutationEnabledImpl: () => Promise<void> | void;
  requireAccessImpl: (moduleId: "spy", capability: "mutate") => Promise<SpyDispatchActor>;
  logActionImpl: (params: {
    actorClerkId: string;
    actorEmail: string;
    module: "spy";
    action: string;
    targetRef: string | null;
    result: "success" | "failure";
    resultDetail: string | null;
    payload: unknown;
  }) => Promise<void>;
  targetRefOf?: (actor: SpyDispatchActor, result: TResult) => string | null;
  payload?: unknown;
}

export declare function dispatchSpyMutationWithAudit<TResult extends { kind: string }>(
  params: DispatchSpyMutationWithAuditParams<TResult>,
): Promise<TResult>;
