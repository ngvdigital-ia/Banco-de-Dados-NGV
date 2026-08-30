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

export const SYSTEM_DIRECTORY: Record<SystemId, {
  title: string;
  eyebrow: string;
  description: string;
}> = {
  "banco-ngv": {
    title: "Banco NGV",
    eyebrow: "Operação central",
    description: "Ofertas e métricas operacionais consolidadas no Core.",
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
    title: "Quiz Analytics",
    eyebrow: "Funis e eventos",
    description: "Projetos de quiz, instalação e recebimento de eventos.",
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

export function isSystemId(value: string): value is SystemId {
  return SYSTEM_IDS.some((system) => system === value);
}
