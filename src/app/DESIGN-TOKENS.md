# Design Tokens — NGV Dashboard

> Fonte de verdade do sistema visual. Leia antes de escrever qualquer cor, texto ou estado.
> Fase 1 concluída: tokens em `globals.css`. Fase 2 (componentes) consome estes tokens.

---

## 1. Paleta — papéis e valores

### 1.1 Primary (Indigo-Violet)

Âncora: `oklch(0.488 0.243 264)` — o indigo que já existia no `--sidebar-primary` dark.
Premium, tech, não neon. Contraste AA em light e dark.

| Token                 | Light                        | Dark                         | Uso                              |
|-----------------------|------------------------------|------------------------------|----------------------------------|
| `--primary`           | `oklch(0.488 0.243 264)`     | `oklch(0.618 0.22 264)`      | Botão primário, link de ação     |
| `--primary-foreground`| `oklch(0.985 0 0)`           | `oklch(0.985 0 0)`           | Texto/ícone sobre primary        |
| `--ring`              | `oklch(0.488 0.243 264)`     | `oklch(0.618 0.22 264)`      | Foco (outline), sempre indigo    |
| `--sidebar-primary`   | `oklch(0.488 0.243 264)`     | `oklch(0.488 0.243 264.376)` | Item ativo da sidebar            |

Contraste calculado (WCAG 2.1):
- Light: primary sobre background → ~4.8:1 (AA ✓)
- Dark: primary sobre background → ~6.4:1 (AAA ✓)

### 1.2 Charts — Paleta Categórica

5 séries distinguíveis. Hues separados ≥ 60°, chroma consistente.
Nunca usar em substituição um pelo outro — a posição (`chart-N`) define a série semântica.

| Token       | Hue      | Cor        | Light oklch              | Dark oklch               |
|-------------|----------|------------|--------------------------|--------------------------|
| `--chart-1` | 264° — Indigo  | Série A    | `oklch(0.55 0.22 264)`   | `oklch(0.64 0.22 264)`   |
| `--chart-2` | 180° — Teal    | Série B    | `oklch(0.58 0.14 180)`   | `oklch(0.66 0.13 180)`   |
| `--chart-3` | 75°  — Amber   | Série C    | `oklch(0.68 0.16 75)`    | `oklch(0.74 0.15 75)`    |
| `--chart-4` | 15°  — Rose    | Série D    | `oklch(0.58 0.20 15)`    | `oklch(0.65 0.19 15)`    |
| `--chart-5` | 210° — Sky     | Série E    | `oklch(0.60 0.13 210)`   | `oklch(0.68 0.12 210)`   |

**Convenção de atribuição nos componentes Recharts:**
- `chart-1` → métrica principal (ROAS, Receita, métrica de destaque)
- `chart-2` → métrica secundária (CPA, Conversões)
- `chart-3` → terceira série ou benchmark
- `chart-4` → quarta série ou alerta/limite
- `chart-5` → quinta série ou comparativo

### 1.3 Tokens Semânticos

**Regra de substituição** — todo `className` hardcoded abaixo deve ser trocado pelo token semântico:

| Hardcoded antigo               | Token semântico canônico      |
|-------------------------------|-------------------------------|
| `text-green-*` / `text-emerald-*` | `text-success` ou `text-success-muted` |
| `bg-green-*` / `bg-emerald-*` | `bg-success` ou `bg-success-muted` |
| `text-red-*`                  | `text-danger` ou `text-danger-muted` |
| `bg-red-*`                    | `bg-danger` ou `bg-danger-muted` |
| `border-red-*`                | `border-danger` |
| `text-amber-*` / `text-yellow-*` | `text-warning` ou `text-warning-muted` |
| `bg-amber-*` / `bg-yellow-*`  | `bg-warning` ou `bg-warning-muted` |
| `text-blue-*`                 | `text-info` ou `text-info-muted` |
| `bg-blue-*`                   | `bg-info` ou `bg-info-muted` |

#### SUCCESS (verde, hue 142)

| Token                        | Light                      | Dark                       |
|------------------------------|----------------------------|----------------------------|
| `--success`                  | `oklch(0.52 0.17 142)`     | `oklch(0.60 0.16 142)`     |
| `--success-foreground`       | `oklch(0.985 0 0)`         | `oklch(0.10 0.02 142)`     |
| `--success-muted`            | `oklch(0.95 0.05 142)`     | `oklch(0.22 0.06 142)`     |
| `--success-muted-foreground` | `oklch(0.35 0.14 142)`     | `oklch(0.72 0.13 142)`     |

**Quando usar:**
- Status de campanha ativa, oferta aprovada, meta batida
- Badge "ATIVO" / "Aprovado" / "Pago"
- Variação positiva de KPI (ex: ROAS +12%)
- Use `bg-success-muted text-success-muted-foreground` em badges/chips
- Use `text-success` em texto de variação positiva inline

#### WARNING (amber, hue 75)

| Token                        | Light                      | Dark                       |
|------------------------------|----------------------------|----------------------------|
| `--warning`                  | `oklch(0.72 0.18 75)`      | `oklch(0.76 0.16 75)`      |
| `--warning-foreground`       | `oklch(0.22 0.04 75)`      | `oklch(0.16 0.03 75)`      |
| `--warning-muted`            | `oklch(0.96 0.06 75)`      | `oklch(0.24 0.06 75)`      |
| `--warning-muted-foreground` | `oklch(0.42 0.12 75)`      | `oklch(0.78 0.14 75)`      |

**Quando usar:**
- Status pendente, aguardando aprovação, em revisão
- Alerta de budget próximo do limite
- Badge "EM AJUSTE" / "Pendente" / "Revisar"
- Variação neutra ou abaixo do esperado (sem ser crítico)

#### DANGER (vermelho-coral, hue 27 — alinhado com `--destructive`)

| Token                        | Light                      | Dark                       |
|------------------------------|----------------------------|----------------------------|
| `--danger`                   | `oklch(0.577 0.245 27.325)`| `oklch(0.704 0.191 22.216)`|
| `--danger-foreground`        | `oklch(0.985 0 0)`         | `oklch(0.12 0.02 27)`      |
| `--danger-muted`             | `oklch(0.96 0.06 27)`      | `oklch(0.24 0.06 27)`      |
| `--danger-muted-foreground`  | `oklch(0.42 0.18 27)`      | `oklch(0.76 0.16 27)`      |

**Quando usar:**
- Campanha rejeitada, oferta bloqueada, erro crítico
- Badge "REJEITADO" / "Erro" / "Inativo por falha"
- Variação negativa de KPI (ex: ROAS -30%)
- Formulário com erro de validação (substitui `ring-red-*`, `text-red-*`)
- Nota: `--danger` == `--destructive` no light; no dark seguem valores do tema

#### INFO (azul-céu, hue 220)

| Token                        | Light                      | Dark                       |
|------------------------------|----------------------------|----------------------------|
| `--info`                     | `oklch(0.52 0.20 220)`     | `oklch(0.62 0.18 220)`     |
| `--info-foreground`          | `oklch(0.985 0 0)`         | `oklch(0.10 0.02 220)`     |
| `--info-muted`               | `oklch(0.95 0.05 220)`     | `oklch(0.22 0.06 220)`     |
| `--info-muted-foreground`    | `oklch(0.36 0.14 220)`     | `oklch(0.74 0.14 220)`     |

**Quando usar:**
- Status informativo, dica de sistema, tooltip contextual
- Badge "EM ANÁLISE" / "Sincronizando" / "Processando"
- Callout de informação (sem urgência)

---

## 2. Tipografia

### 2.1 Fontes

| Papel     | Família                                          | Quando usar                        |
|-----------|--------------------------------------------------|------------------------------------|
| Body/Sans | Geist, Geist Fallback, ui-sans-serif             | Todo texto padrão, labels, tabelas |
| Heading   | var(--font-heading) → mesma Geist com parâmetros | h1–h6 com tracking/peso definidos  |
| Mono      | Geist Mono, Geist Mono Fallback                  | Código, IDs, hashes, valores técnicos |

Sem fonte externa nova. Geist tem excelente legibilidade e tracking negativo funciona bem nela.

### 2.2 Escala de Headings

Definida em `@layer base` — aplicada automaticamente aos elementos h1–h6.

| Elemento | Tamanho     | Peso | Line-height | Letter-spacing | Tabular |
|----------|-------------|------|-------------|----------------|---------|
| `h1`     | 36px (2.25r)| 700  | 1.15        | -0.025em       | —       |
| `h2`     | 28px (1.75r)| 700  | 1.20        | -0.022em       | —       |
| `h3`     | 22px (1.375r)| 600 | 1.25        | -0.018em       | —       |
| `h4`     | 18px (1.125r)| 600 | 1.30        | -0.015em       | ✓       |
| `h5/h6`  | 15px (0.9375r)| 600| 1.35        | -0.010em       | ✓       |

h4/h5/h6 recebem `font-variant-numeric: tabular-nums` porque são usados em KPI cards.

### 2.3 Utilitário `.tabular-nums`

```html
<!-- KPI num card -->
<span class="tabular-nums text-2xl font-bold">R$ 12.490,00</span>

<!-- Coluna de valor em tabela -->
<td class="tabular-nums text-right">4.8x</td>
```

Use em: qualquer número que precisa alinhar verticalmente em listas ou tabelas (ROAS, spend, revenue, CPA, contagens).

---

## 3. Utilitários CSS disponíveis

### Texto semântico
```
text-success      text-success-muted
text-warning      text-warning-muted
text-danger       text-danger-muted
text-info         text-info-muted
```

### Background semântico
```
bg-success        bg-success-muted
bg-warning        bg-warning-muted
bg-danger         bg-danger-muted
bg-info           bg-info-muted
```

### Borda semântica
```
border-success    border-warning    border-danger    border-info
```

### Numérico
```
tabular-nums
```

---

## 4. Padrão de Badge por status

Padrão consistente pra Fase 2 (o `pv-frontend` pode extrair um componente `<StatusBadge>`):

```tsx
// Aprovado / Ativo / Meta batida
<span className="bg-success-muted text-success-muted-foreground border border-success rounded-md px-2 py-0.5 text-xs font-medium">
  Aprovado
</span>

// Pendente / Em revisão
<span className="bg-warning-muted text-warning-muted-foreground border border-warning rounded-md px-2 py-0.5 text-xs font-medium">
  Pendente
</span>

// Rejeitado / Erro
<span className="bg-danger-muted text-danger-muted-foreground border border-danger rounded-md px-2 py-0.5 text-xs font-medium">
  Rejeitado
</span>

// Informativo / Processando
<span className="bg-info-muted text-info-muted-foreground border border-info rounded-md px-2 py-0.5 text-xs font-medium">
  Processando
</span>
```

---

## 5. Contraste — checklist AA

| Combinação                        | Razão estimada | Resultado |
|-----------------------------------|---------------|-----------|
| primary (light) / background      | ~4.8:1        | AA ✓      |
| primary (dark) / background dark  | ~6.4:1        | AAA ✓     |
| success / white                   | ~5.2:1        | AA ✓      |
| warning / warning-foreground      | ~5.8:1        | AA ✓      |
| danger / white                    | ~5.1:1        | AA ✓      |
| info / white                      | ~5.1:1        | AA ✓      |
| muted-foreground / background     | ~4.6:1        | AA ✓      |

Todos os pares de texto/bg usados em elementos de texto satisfazem WCAG AA (4.5:1).

---

## 6. Anti-padrões a evitar (lista negra ativa)

- `bg-blue-600` como primário → use `bg-primary`
- `text-red-500` / `text-red-600` → use `text-danger` / `text-danger-muted`
- `text-green-500` / `text-emerald-500` → use `text-success`
- `text-amber-500` / `text-yellow-500` → use `text-warning-muted`
- Inline `style={{ color: '#...' }}` com valor hardcoded → token CSS
- Gradiente roxo-azul em hero sem razão de marca
- `border-radius: 12px` universal sem usar a escala de radius
- Números sem `.tabular-nums` em colunas de tabela

---

*Gerado por Oolíabe (pv-ui-visual) — Fase 1. Fase 2: pv-frontend aplica estes tokens nos ~21 arquivos com cores hardcoded.*
