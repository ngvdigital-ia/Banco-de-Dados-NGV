export const isOperationCockpitEnabled =
  process.env.NEXT_PUBLIC_OPERATION_COCKPIT_ENABLED === "true";

// Flag server-side (não NEXT_PUBLIC) da Command API do corte 2B2-B.
// Guarda `typeof window === "undefined"` evita vazar/bundlar a env no client:
// no browser a expressão nem chega a avaliar process.env e resolve false.
export const isOperationCommandsEnabled =
  typeof window === "undefined" && process.env.OPERATION_COMMANDS_ENABLED === "true";

export const isOperationCommandDispatchEnabled =
  typeof window === "undefined" && process.env.OPERATION_COMMAND_DISPATCH_ENABLED === "true";

export const isOperationCommandStatusEnabled =
  typeof window === "undefined" && process.env.OPERATION_COMMAND_STATUS_ENABLED === "true";

export const isOperationQuizAnalyticsEnabled =
  typeof window === "undefined" && process.env.OPERATION_QUIZ_ANALYTICS_ENABLED === "true";

export const isOperationSpyAnalyticsEnabled =
  typeof window === "undefined" && process.env.OPERATION_SPY_ANALYTICS_ENABLED === "true";

// Ativa somente a apresentação da saúde por fonte vinda do Core. Não troca a
// autoridade do Neon, não despacha comandos e permite rollback imediato.
export const isOperationCoreSourceStateEnabled =
  typeof window === "undefined" && process.env.OPERATION_CORE_SOURCE_STATE_ENABLED === "true";

// Módulos transversais de leitura. As flags só são avaliadas no servidor para
// que o estado do rollout não vire configuração pública nem habilite consultas
// no browser.
export const isOperationExecutionModuleEnabled =
  typeof window === "undefined" && process.env.OPERATION_EXECUTION_MODULE_ENABLED === "true";

export const isOperationDeploymentDomainsModuleEnabled =
  typeof window === "undefined" && process.env.OPERATION_DEPLOYMENT_DOMAINS_MODULE_ENABLED === "true";

// Leitura agregada e privada da evidência de ciclo de vida no NGV Core. A
// flag não usa NEXT_PUBLIC: ausente/false impede qualquer chamada do servidor
// ao Core e permite rollback imediato.
export const isOperationLifecycleEvidenceEnabled =
  typeof window === "undefined" && process.env.OPERATION_LIFECYCLE_EVIDENCE_ENABLED === "true";

// Resumo privado de comércio do NGV Core. Ausente/false impede a leitura no
// servidor e não expõe credencial, configuração ou estado de rollout ao browser.
export const isOperationCommerceReadbackEnabled =
  typeof window === "undefined" && process.env.OPERATION_COMMERCE_READBACK_ENABLED === "true";
