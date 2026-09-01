export const SYSTEM_IDS = [
  "banco-ngv",
  "apps-ofertas",
  "cursos",
  "spy",
  "quiz",
  "nexfy",
  "monitoramento",
] as const;

export type SystemId = (typeof SYSTEM_IDS)[number];

// Módulos transversais do cockpit. Eles têm navegação e autorização próprias,
// mas não representam fontes do NGV Core e não podem entrar em SYSTEM_IDS:
// o parser/rota genérica continua reconhecendo exatamente as sete fontes.
export const TRANSVERSAL_OPERATION_MODULE_IDS = [
  "execucao",
  "publicacao",
] as const;

export type TransversalOperationModuleId = (typeof TRANSVERSAL_OPERATION_MODULE_IDS)[number];

export const SYSTEM_DIRECTORY: Record<SystemId, {
  title: string;
  eyebrow: string;
  description: string;
}> = {
  "banco-ngv": {
    title: "Banco NGV",
    eyebrow: "Operação central",
    description: "Dados do dashboard: ofertas cadastradas e leituras históricas de métricas consolidadas no Core.",
  },
  "apps-ofertas": {
    title: "Apps Ofertas",
    eyebrow: "Acessos pós-compra",
    description: "Catálogo, compras e acessos projetados para a área de membros.",
  },
  cursos: {
    title: "Plataforma de Cursos",
    eyebrow: "Conteúdo e entitlements",
    description: "Catálogo de cursos e acessos de alunos, sem dados pessoais.",
  },
  spy: {
    title: "Spy Analytics",
    eyebrow: "Inteligência de mercado",
    description: "Leituras agregadas de anúncios e ofertas observadas.",
  },
  quiz: {
    title: "Funnel Analytics",
    eyebrow: "Funis e eventos",
    description: "Leitura de funis, instalação e recebimento de eventos.",
  },
  nexfy: {
    title: "Nexfy",
    eyebrow: "Operação separada",
    description: "Visão de projetos e produtos; financeiro permanece fora desta onda.",
  },
  monitoramento: {
    title: "Monitoramento NGV",
    eyebrow: "Domínios e infraestrutura",
    description: "Resumo agregado de projetos, domínios, assinaturas e infraestrutura monitorados.",
  },
};

export const TRANSVERSAL_OPERATION_MODULE_DIRECTORY: Record<TransversalOperationModuleId, {
  title: string;
  eyebrow: string;
  description: string;
}> = {
  execucao: {
    title: "Execução",
    eyebrow: "Recibos locais",
    description: "Recibos sanitizados do fluxo operacional, sem consultar ou controlar o runner nesta tela.",
  },
  publicacao: {
    title: "Publicação",
    eyebrow: "Registro local",
    description: "Endereços registrados por oferta; a verificação externa permanece pendente até haver evidência própria.",
  },
};

export function isSystemId(value: string): value is SystemId {
  return SYSTEM_IDS.some((system) => system === value);
}

export function isTransversalOperationModuleId(value: string): value is TransversalOperationModuleId {
  return TRANSVERSAL_OPERATION_MODULE_IDS.some((module) => module === value);
}
