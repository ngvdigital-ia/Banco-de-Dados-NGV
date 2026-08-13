# DESIGN — Operação Integrada NGV (`/operacao`)

Direção visual somente leitura. Este documento não autoriza novas fontes de dados, chamadas externas, mutações, deploy ou preenchimento de lacunas com dados inventados.

## 1. conceito-ancora

**"Torre de controle: uma única linha de voo torna visível onde cada oferta está, o que a segura e qual sistema confirma o estado."**

A âncora aparece como uma linha operacional contínua, fina e ortogonal, que atravessa o resumo, conecta as fases 0–7 e reaparece como trilho na primeira coluna da tabela. Não usar mapa decorativo, radar falso ou ilustração genérica de dashboard.

### Arquitetura visual da página

1. **Cabeçalho de turno:** `Operação` + timestamp real da última consolidação + selo `Somente leitura`. À direita, apenas filtros locais existentes; nenhum CTA de mutação.
2. **Resumo de tráfego:** faixa única de 4 indicadores reais: ofertas observadas, em movimento, bloqueadas e prontas para revisão. Números ausentes exibem `—`, nunca `0` inferido.
3. **Linha de voo 0–7:** oito estações horizontais conectadas por um trilho de 1px. Cada estação mostra fase, nome curto, quantidade confirmada e saúde. No mobile vira lista vertical, preservando a ordem 0→7 e o trilho à esquerda.
4. **Mesa operacional de ofertas:** desktop em tabela densa e sticky; mobile em cartões compactos. Alternância local `Tabela | Fluxo` pode trocar para kanban por fase sem mudar dados. A primeira coluna fixa contém nome, `offer_id` em mono e posição no trilho.
5. **Bloqueios:** fila ordenada por severidade e antiguidade, não por estética. Cada linha responde: oferta, bloqueio confirmado, fonte que o reportou e última evidência. Sem bloqueios, usar estado vazio explícito — não ocultar a seção.
6. **Fontes e saúde:** matriz compacta ClickUp, Drive, registry, runner, n8n, Apps e publicação. Colunas: conexão, última leitura, cobertura e estado. Uma fonte desconhecida é `Não verificada`, nunca verde.
7. **Auditoria:** linha do tempo textual de eventos sanitizados, com `event_id`, horário, origem e resultado. Conteúdo técnico secundário recolhível; nenhuma PII.

**Desktop ≥1280px:** conteúdo em grid de 12 colunas; linha 0–7 ocupa 12, mesa ocupa 8 e bloqueios 4; fontes e auditoria ocupam 6+6. **Tablet 768–1279px:** tudo em 12 colunas, mesa e bloqueios empilhados. **Mobile 375–767px:** uma coluna, resumo em grade 2×2, pipeline vertical, cartões de oferta e auditoria em lista; nenhuma tabela espremida ou scroll horizontal obrigatório.

## 2. modo

**`imersivo-leve`**, dentro do modo de produto imersivo: profundidade vem de composição, estado e continuidade visual; zero WebGL, canvas, vídeo, parallax, biblioteca nova ou background animado.

- Densidade inicial: resumo + linha 0–7 visíveis no primeiro viewport desktop; no mobile, resumo + fases críticas.
- Progressão: visão geral → exceções → evidência. Detalhes técnicos começam recolhidos.
- Superfície: fundo neutro contínuo; módulos separados por bordas e mudança mínima de tom, não por caixas flutuantes.
- Imersão: o trilho operacional permanece como referência visual durante o scroll; não usar sticky que esconda conteúdo ou reduza a área útil mobile.
- Regra read-only: nenhum controle parece botão de execução. Links externos usam ícone e rótulo explícito; filtros são visualmente secundários.

## 3. color

Reutilizar os tokens canônicos de `globals.css`; os HEX abaixo são equivalentes sRGB concretos para documentação, não novos hardcodes.

```yaml
color:
  base-light: "#FFFFFF / oklch(1 0 0) / var(--background)"
  ink-light: "#0A0A0A / oklch(0.145 0 0) / var(--foreground)"
  base-dark: "#0A0A0A / oklch(0.145 0 0) / var(--background)"
  surface-dark: "#171717 / oklch(0.205 0 0) / var(--card)"
  destaque: "#1048E6 / oklch(0.488 0.243 264) / var(--primary)"
  destaque-dark: "#3E79FF / oklch(0.618 0.22 264) / var(--primary)"
  acento: "#E5EDFC / oklch(0.945 0.022 264) / var(--accent)"
  muted: "#F5F5F5 / oklch(0.97 0 0) / var(--muted)"
  border: "#E5E5E5 / oklch(0.922 0 0) / var(--border)"
  success: "#147F0A / oklch(0.52 0.17 142) / var(--success)"
  warning: "#E49000 / oklch(0.72 0.18 75) / var(--warning)"
  danger: "#E7000B / oklch(0.577 0.245 27.325) / var(--danger)"
  info: "#007CB7 / oklch(0.52 0.20 220) / var(--info)"
```

- Indigo indica posição/seleção e continuidade do trilho; nunca significa saúde.
- `success`, `warning`, `danger` e `info` seguem somente significado semântico existente.
- Estado `Não verificado`: `bg-muted text-muted-foreground border-border`, jamais verde diluído.
- Cor nunca é o único sinal: todo estado combina texto + ícone Lucide + forma/borda.
- Charts, se necessários depois, mantêm `--chart-1..5`; esta visão inicial não cria gráfico só para preencher espaço.

## 4. typography

```yaml
typography:
  display: "Geist 700 / Geist Fallback, ui-sans-serif, system-ui"
  body: "Geist 400–500 / Geist Fallback, ui-sans-serif, system-ui"
  mono: "Geist Mono 500 / Geist Mono Fallback, ui-monospace, monospace"
  h1: "clamp(2.25rem, 3.4vw, 3.5rem) / -0.035em / 0.98"
  h2: "clamp(1.375rem, 2vw, 1.75rem) / -0.022em / 1.15"
  h3: "1.125rem / -0.015em / 1.25"
  h4: "0.9375rem / -0.010em / 1.35"
  body-main: "0.875rem / 0 / 1.5"
  body-compact: "0.8125rem / 0 / 1.4"
  label: "0.6875rem / 0.10em / 1.2 / uppercase"
  technical: "0.75rem / 0 / 1.4 / tabular-nums"
```

- H1 maior que as páginas atuais apenas no cabeçalho de turno; não repetir display monumental em cada módulo.
- Números, duração, cobertura, IDs, hashes e timestamps sempre `font-mono tabular-nums`.
- Títulos de seção em sentence case. Uppercase reservado a labels de fase e sinais curtos.
- Largura de texto explicativo: `max-width: 68ch`; células longas truncam visualmente, mas preservam valor completo em tooltip acessível.

## 5. spacing

```yaml
spacing: "[4, 8, 12, 16, 24, 32, 48, 64, 96]px — nada fora sem justificativa registrada"
page-inline: "16px mobile / 24px tablet / 32px desktop"
page-block: "24px mobile / 32px desktop"
section-gap: "32px mobile / 48px desktop"
module-padding: "12px compact / 16px standard / 24px summary"
grid-gap: "12px operational / 16px sectional / 24px major"
row-height: "40px table / 48px touch row"
```

- Ritmo de cockpit: dados relacionados ficam próximos (`4–12px`); mudanças de contexto usam `24–48px`.
- Pipeline desktop mantém todas as oito fases numa linha apenas quando cada estação preserva largura mínima de `112px`; abaixo disso muda de composição, não comprime texto.
- Alvos interativos têm mínimo `44×44px` no mobile, mesmo quando o conteúdo visual é compacto.

## 6. components

```yaml
components:
  radius:
    control: "6px / rounded-md"
    operational-row: "6px"
    module: "10px / var(--radius-lg)"
    summary-band: "10px; nunca pill"
  shadow:
    default: "none"
    hover: "0 4px 14px rgb(10 10 10 / 0.08)"
    overlay: "0 18px 48px rgb(10 10 10 / 0.18)"
  border: "1px solid var(--border); trilho 1px solid color-mix(in oklch, var(--primary) 34%, var(--border))"
  estados:
    hover: "background var(--accent); borda var(--primary)/30; sem lift em linhas"
    focus: "outline 2px var(--ring), offset 2px"
    active: "background var(--primary); foreground var(--primary-foreground) somente em filtro/aba selecionada"
    disabled: "opacity .5; cursor not-allowed; mantém rótulo legível"
```

### Vocabulário de componentes

- **Faixa-resumo:** uma superfície contínua dividida por separadores; não quatro cards idênticos soltos.
- **Estação de fase:** índice `00–07` em mono, rótulo, contagem e estado. Fase atual/filtrada usa indigo; saúde usa token semântico separado.
- **Tabela operacional:** adaptar o padrão de `OfferTable`: header sticky, primeira coluna sticky, zebra sutil, borda esquerda por exceção. Não duplicar edição inline, pois `/operacao` é read-only.
- **Kanban de leitura:** colunas por fase, sem drag handle e sem affordance de drop. Cards exibem apenas identidade, estado, bloqueio e última evidência.
- **Bloqueio:** linha com severidade, texto factual, fonte e idade; perigo usa barra esquerda de 3px, não fundo vermelho dominante.
- **Matriz de saúde:** linhas de fonte, colunas de evidência; ícone + texto `Operante`, `Degradada`, `Indisponível`, `Não verificada`.
- **Auditoria:** timeline ortogonal de 1px; eventos usam ponto quadrado de 6px, nunca bolhas decorativas.

### Estados de dados

- **Loading:** preservar geometria final com `Skeleton`; pipeline com 8 estações e 3–5 linhas de tabela. Não usar spinner como página inteira.
- **Vazio global:** `Nenhuma oferta disponível nas fontes selecionadas.` + explicação `A visão não cria registros.` Sem CTA de criação.
- **Vazio de bloqueios:** ícone `ShieldCheck`, texto `Nenhum bloqueio confirmado nesta leitura.` e timestamp real.
- **Erro parcial:** módulo permanece no lugar, borda `danger`, fonte afetada e mensagem sanitizada; demais módulos continuam visíveis.
- **Erro global:** título `Não foi possível consolidar a operação`, lista de fontes que falharam e horário da tentativa; nunca expor segredo, stack ou PII.
- **Stale:** selo warning `Dados antigos` com idade real e fonte; não esconder nem reinterpretar como estado atual.

### Acessibilidade

- Estrutura semântica `header`, `nav aria-label="Fases da operação"`, `main`, `section aria-labelledby`, `table` com `scope="col"` e `time datetime`.
- Pipeline navegável por teclado na ordem 0→7; foco nunca depende de hover.
- Status sempre textual; ícones decorativos `aria-hidden`, ícones informativos com nome acessível.
- Contraste mínimo WCAG AA; foco 2px visível em light/dark; touch target mínimo 44px.
- Atualizações somente leitura usam `aria-live="polite"` apenas no resumo do resultado, evitando anunciar a tabela inteira.
- Respeitar zoom 200%, reflow a 320px e `prefers-reduced-motion`.

## 7. motion

```yaml
motion:
  dur-micro: "140ms"
  dur-layout: "240ms"
  dur-page: "360ms"
  ease-out: "cubic-bezier(0.16, 1, 0.3, 1)"
  ease-in: "cubic-bezier(0.4, 0, 1, 1)"
  ease-inout: "cubic-bezier(0.45, 0, 0.55, 1)"
```

- Entrada inicial: trilho revela por escala X em `360ms`; estações entram em opacidade com stagger máximo total de `240ms`. O conteúdo base já nasce visível se JS falhar.
- Filtro: contagens fazem crossfade de `140ms`; linhas não deslizam pela tela.
- Expansão de detalhe: altura/opacidade em `240ms`; foco segue para o título expandido somente quando iniciado por teclado.
- Saúde em atualização: shimmer existente apenas dentro do skeleton; nenhum pulso infinito em estado estável.
- `prefers-reduced-motion: reduce`: duração `1ms`, sem transform, stagger, shimmer ou auto-scroll; mudança de estado é instantânea e textual.

## 8. voice

```yaml
voice:
  do:
    - "3 ofertas bloqueadas na fase 4"
    - "ClickUp lido há 6 min"
    - "Não verificado: falta evidência pública"
    - "Nenhum bloqueio confirmado nesta leitura"
    - "Dados antigos — última leitura há 2 h"
  dont:
    - "Tudo certo!"
    - "Algo deu errado"
    - "A IA está trabalhando para você"
    - "Performance incrível"
    - "Sem dados"
```

- Tom: sala de operações calma, factual e responsabilizável.
- Fórmula: **estado + objeto + evidência/tempo**. Ex.: `Bloqueada · Neuro Honey · tracking não confirmado há 18 min`.
- Distinguir `Pendente`, `Bloqueada`, `Não verificada` e `Indisponível`; nunca fundir em “erro”.
- Não atribuir causalidade, sucesso, dono ou urgência que os dados não comprovem.
- Rótulos técnicos em português; identificadores preservam grafia canônica em mono.

## 9. anti-patterns

```yaml
anti-patterns:
  - "Nenhum gradiente roxo→azul; indigo é trilho/seleção, não decoração de fundo."
  - "Nenhum hero H1 + subtítulo + dois CTAs + screenshot; esta é uma estação de trabalho read-only."
  - "Nenhum grid de cards KPI independentes com radius 12px e shadow universal; usar faixa-resumo contínua."
  - "Nenhum semáforo só por cor; sempre ícone + rótulo + evidência."
  - "Nenhum gráfico donut/gauge para contagem que cabe em número e texto."
  - "Nenhum radar, mapa ou animação de pontos que não represente dado real."
  - "Nenhum emoji como ícone; reutilizar Lucide já instalado."
  - "Nenhuma nova fonte, dependência, WebGL, canvas ou biblioteca de motion."
  - "Nenhum CTA de executar, aprovar, editar, publicar ou sincronizar dentro de /operacao."
  - "Nenhum zero, verde ou porcentagem derivados de dado ausente; usar — ou Não verificado."
  - "Nenhuma tabela desktop esmagada no mobile; trocar por cards operacionais."
  - "Nenhum conteúdo invisível por animação, JS ou falha de uma fonte parcial."
```

### Rubrica 5-dim — gate da implementação

| Dimensão | Nota | Evidência objetiva |
|---|---:|---|
| Conceito/Intenção | 9 | Implementado no trilho interativo 0–7, bordas de exceção e timeline ortogonal. |
| Tipografia/Hierarquia | 8 | Geist existente aplicado; display único e mono/tabular em fases, IDs, contagens e datas. |
| Restrição/Whitespace | 9 | Faixa-resumo contínua, grid 8+4/6+6 e tokens existentes; nenhuma dependência visual nova. |
| Craft/Detalhe | 9 | Reflow mobile sem tabela forçada, timestamp/PENDING por fonte, `event_id` selecionável, alvos 44px, ordenação determinística e erro global factual; lint/typecheck/testes/build passam. |
| Anti-genérico | 9 | Faixa-resumo e linha de voo implementadas no lugar de hero, donuts e coleção de KPI cards. |
| **Média** | **8,8** | **PASS: média ≥7 e nenhuma dimensão <5.** |

### Checklist anti-slop

- [x] 0 gradientes decorativos roxo→azul.
- [x] 0 fonte genérica adicionada; Geist existente tem escala e função definidas.
- [x] 0 botão azul primário sem papel; `/operacao` não tem ação de mutação.
- [x] 0 radius universal; hierarquia `6px/10px` definida.
- [x] 0 grid de três ícones ou hero de template.
- [x] 0 emoji como iconografia.
- [x] 0 gráfico ornamental ou dado inventado.
- [x] 0 dependência visual nova.
- [x] 0 conteúdo invisível por motion.
- [x] 0 estado comunicado apenas por cor.

**Veredito anti-slop estático: PASS — 0 violações encontradas no código implementado.** Snapshot check, 8 testes específicos, ESLint, TypeScript e build de produção passaram. Uma revisão visual autenticada em mobile e desktop continua sendo um gate separado antes de produção.
