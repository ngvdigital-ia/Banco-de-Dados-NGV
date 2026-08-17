# Webhook: Atualizar domínios de oferta

Endpoints pro **agente Claude Code de criação de páginas** listar ofertas e atualizar URLs no banco NGV Digital.

> **Versão**: 1.2 (Agosto/2026)
> **Endpoints**:
> - `GET https://banco-de-dados-ngv.vercel.app/api/admin/offers` — listar ofertas (resolver matches)
> - `GET https://banco-de-dados-ngv.vercel.app/api/admin/offers/lookup` — **ler UMA oferta inteira, com os links** (seção 0.5)
> - `POST https://banco-de-dados-ngv.vercel.app/api/admin/offer-domains` — atualizar URLs
>
> **Auth (todos)**: `Authorization: Bearer ${CRON_SECRET}`

## 0. Endpoint de descoberta — `GET /api/admin/offers`

**Use isso PRIMEIRO** quando seu registry local tem nomes diferentes do banco (idiomas, traduções, sufixos). Resolve `offerName` ambíguo (409) ou não encontrado (404) sem precisar adivinhar.

### Request

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://banco-de-dados-ngv.vercel.app/api/admin/offers
```

### Query params (opcionais)

| Param | Valor | Filtra |
|---|---|---|
| `language` | `EN`, `FR`, `DE`, `ITA`, `ES`, `PT` | só ofertas naquele idioma |
| `validation` | `SIM` | só validadas |
| `has_site_urls` | `true` ou `false` | com/sem URLs já configuradas |

Exemplo combinado: `?language=DE&has_site_urls=false` retorna alemãs ainda sem URLs.

### Response (200)

```json
{
  "success": true,
  "total": 26,
  "offers": [
    {
      "id": 175,
      "name": "Sciatic Shield",
      "language": "EN",
      "validation": "EM ANDAMENTO",
      "scale": "NAO",
      "hasSiteUrls": true,
      "linkCount": 1,
      "domain": "sciaticshield.com"
    },
    ...
  ]
}
```

### Fluxo recomendado pro agente externo

1. **Boot**: chama `GET /api/admin/offers` 1x e cacheia na sessão
2. **Pra cada oferta no registry local**: faz match por `name` (case-insensitive, sem acento, sem espaço) contra os 3 candidatos do banco (`name`, primeiras palavras, etc)
3. **Em caso de empate** (ex: `Skyvault` vs `SkyVault (Leva04)`): pede ao Pedro decidir, ou usa heurística (`Leva04` é mais nova; `(...)` indica variant)
4. **Salva o map `slug → offerId`** no estado da skill pra próximas chamadas
5. **POST com `offerId`** (não `offerName`) — zero ambiguidade

---

## 0.5. Endpoint de leitura — `GET /api/admin/offers/lookup`

**Use isso quando a pergunta for "qual é o link dessa oferta?"** — o `GET /api/admin/offers` da
seção 0 devolve lista enxuta pra resolver nome→id, e **não traz as URLs**. Este traz a oferta
inteira, com o `siteUrls` completo.

É o par de leitura do `POST /api/admin/offer-domains`: você grava um link por aqui e **lê de
volta por ali**, em vez de perguntar de novo ao Pedro na sessão seguinte.

### Request

```bash
# Por id (preferido — sem ambiguidade)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://banco-de-dados-ngv.vercel.app/api/admin/offers/lookup?id=175"

# Por nome (busca "contém", case-insensitive)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://banco-de-dados-ngv.vercel.app/api/admin/offers/lookup?name=Sciatic"
```

`?id=` tem precedência sobre `?name=` (mesma precedência de `offerId` sobre `offerName` no POST).

### Response (200)

```json
{
  "success": true,
  "matchedBy": "id",
  "offer": {
    "id": 175,
    "name": "Sciatic Shield",
    "language": "EN",
    "ticket": "97",
    "gender": "Homens",
    "adFormat": "VSL",
    "status": {
      "copyVsl": "SIM", "copyCriativos": "SIM", "vslInVturb": "SIM",
      "campaignsActive": "NAO", "validation": "EM ANDAMENTO", "preScale": "NAO",
      "scale": "NAO", "productCreated": "SIM", "productApproved": "SIM", "siteCreated": "SIM"
    },
    "ads": { "editedCount": 12, "rejectedCount": 2 },
    "hasSiteUrls": true,
    "linkCount": 4,
    "domain": "sciaticshield.com",
    "siteUrls": {
      "domain": "sciaticshield.com",
      "vsl": "https://sciaticshield.com/vsl",
      "whites": ["https://sciaticshield.com/white-1"],
      "quiz": "https://sciaticshield.com/quiz",
      "custom": [{ "label": "Obrigado", "url": "https://sciaticshield.com/obrigado" }]
    },
    "siteUrl": "https://sciaticshield.com/vsl",
    "createdAt": "2026-01-02T03:04:05.000Z",
    "updatedAt": "2026-02-03T04:05:06.000Z"
  }
}
```

**`hasSiteUrls` responde "já tem PÁGINA no ar?"** — é `linkCount > 0`, e `linkCount` conta
`vsl + quiz + whites + custom`. **`domain` não conta como página**: oferta com domínio comprado e
nenhuma página publicada vem `hasSiteUrls: false` com o `domain` preenchido — que é exatamente o
sinal de "o domínio é esse, pode criar as páginas nele".

> Cuidado: no `GET /api/admin/offers` (seção 0) o campo homônimo `hasSiteUrls` significa outra
> coisa — "a coluna existe" — e lá quem desmente é o `linkCount` ao lado. **Nas duas rotas,
> confie no `linkCount`.**

### Erros

| Status | Código | Quando | O que fazer |
|---|---|---|---|
| `401` | `UNAUTHORIZED` | Bearer errado ou ausente | conferir o `CRON_SECRET` |
| `400` | `MISSING_IDENTIFIER` | nem `?id=` nem `?name=` | mandar um dos dois |
| `400` | `INVALID_ID` | `?id=` não é inteiro positivo | usar o `id` do `GET /api/admin/offers` |
| `404` | `OFFER_NOT_FOUND` | não existe | criar a oferta no dashboard antes |
| `409` | `OFFER_NAME_AMBIGUOUS` | `?name=` casou com 2+ | **ver abaixo** |

**O 409 não escolhe por você — de propósito.** Nomes colidem nesta base (`Skyvault` vs
`SkyVault (Leva04)`), e uma escolha no chute aqui vira gravação na oferta errada depois. A
resposta traz `totalMatches` e até 10 `candidates` com `{id, name, language, validation, domain,
createdAt}`: desempate e repita com `?id=`.

```json
{
  "error": "2 ofertas casam com \"Alpha\". Escolha uma e repita com ?id=<id>.",
  "code": "OFFER_NAME_AMBIGUOUS",
  "totalMatches": 2,
  "candidates": [
    { "id": 12, "name": "Alpha DE", "language": "DE", "validation": "SIM", "domain": "alpha.de", "createdAt": "..." },
    { "id": 30, "name": "Alpha PT", "language": "PT", "validation": "SIM", "domain": "alpha.com.br", "createdAt": "..." }
  ]
}
```

### O que NÃO vem (allowlist, de propósito)

Quem é a **pessoa** (copywriter, editor, contagens por pessoa) e o campo livre `observations`
ficam fora do retorno. O consumidor aqui é máquina e quer link/status, não equipe — e
`observations` é onde telefone e dado pessoal entram por acidente.

**Atenção com `siteUrls.custom`**: é `{label, url}` livre. Se alguém gravou um link de
checkout/preview com `?token=`, ele volta inteiro aqui. Trate a resposta como sensível.

---

## 1. Setup do agente

O agente precisa do **CRON_SECRET** (variável de ambiente do projeto). Pedro pode te passar via env var local ou injetar no contexto. Nunca commitar em código.

```bash
# .env do agente
CRON_SECRET="ngv_cron_secret_..."
```

---

## 2. Schema do payload

```ts
{
  // Identificação da oferta — escolher UMA das opções:
  offerId?: number,         // preferido — match exato (ex: 201)
  offerName?: string,       // fallback — busca ILIKE %name% (case-insensitive)

  // URLs (todos opcionais — só envie o que mudou):
  domain?: string,          // host raiz, ex: "meusite.com"
                            // se omitido, é inferido automaticamente da VSL
  vsl?: string,             // URL única da VSL
  whites?: string[],        // array de URLs (Páginas White)
  quiz?: string,            // URL única do Quiz
  custom?: {                // links extras nomeados (pixel, obrigado, etc)
    label: string,
    url: string,
  }[],

  // Comportamento:
  merge?: boolean           // default: true
}
```

### Regras de URL

- Aceita só `http://` ou `https://` (rejeita `javascript:`, `data:`, etc)
- Se vier sem protocolo, é normalizado pra `https://...`
- Host vira lowercase, trailing `/` é removido
- Cap de **50 links totais** por oferta

### Resolução de oferta

- **`offerId`** sempre preferido (sem ambiguidade)
- **`offerName`** funciona com pedaços do nome (ex: `"Segredo"` casa `"Segredo da Reconquista"`)
- Se `offerName` casa **múltiplas** ofertas → erro **409** com a lista de candidatas; nesse caso reenvie com `offerId` ou nome mais específico

---

## 3. Comportamento de `merge`

| Campo | `merge: true` (default) | `merge: false` |
|---|---|---|
| `domain`, `vsl`, `quiz` | Substitui se vier no payload, senão preserva | Substitui completamente (omitido = some) |
| `whites`, `custom` | **União** com dedup por URL normalizada | Substitui completamente |

**Regra prática**:
- **Adicionar um link novo** sem mexer no resto → use `merge: true` (default)
- **Substituir tudo** (ex: refazer setup do zero) → use `merge: false`

**Dedup automático em `whites`/`custom`**: se mandar a mesma URL 2x, só aparece 1x.
Comparação ignora trailing `/`, case do host e protocolo.

---

## 4. Casos de uso

### Caso A — Criou a VSL pela primeira vez

```bash
curl -X POST https://banco-de-dados-ngv.vercel.app/api/admin/offer-domains \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "offerName": "Segredos da Reconquista",
    "vsl": "https://meusite.com/vsl-pt"
  }'
```

→ jsonb fica `{ "domain": "meusite.com", "vsl": "https://meusite.com/vsl-pt" }`
→ `site_url` (legacy) também é sincronizado com a VSL
→ `site_created` vira `"SIM"` automaticamente (cascata)

### Caso B — Adicionou 2 páginas White

```bash
curl -X POST https://banco-de-dados-ngv.vercel.app/api/admin/offer-domains \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "offerName": "Segredos da Reconquista",
    "whites": [
      "https://meusite.com/white-1",
      "https://meusite.com/white-2"
    ]
  }'
```

→ Whites aparecem na lista, **VSL preservada** (merge=true default).

### Caso C — Adicionou Quiz e Pixel

```bash
curl -X POST https://banco-de-dados-ngv.vercel.app/api/admin/offer-domains \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "offerName": "Segredos da Reconquista",
    "quiz": "https://meusite.com/quiz-pt",
    "custom": [
      { "label": "Pixel Facebook", "url": "https://meusite.com/pixel" },
      { "label": "Obrigado", "url": "https://meusite.com/obrigado" }
    ]
  }'
```

→ Quiz adicionado + 2 customs nomeados, VSL e Whites preservados.

### Caso D — Refazer setup do zero

```bash
curl -X POST https://banco-de-dados-ngv.vercel.app/api/admin/offer-domains \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "offerName": "Segredos da Reconquista",
    "vsl": "https://novosite.com/vsl-pt",
    "merge": false
  }'
```

→ **Apaga tudo** (whites, quiz, custom) e fica só com a VSL nova. Perigoso — só usar quando souber.

### Caso E — Sabe o ID exato da oferta

```bash
curl -X POST https://banco-de-dados-ngv.vercel.app/api/admin/offer-domains \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "offerId": 201,
    "vsl": "https://meusite.com/vsl-pt"
  }'
```

→ Match instantâneo, zero ambiguidade.

---

## 5. Resposta de sucesso (200)

```json
{
  "success": true,
  "offerId": 201,
  "merged": true,
  "summary": "VSL adicionada, 1 white adicionada",
  "delta": {
    "added": {
      "vsl": "https://meusite.com/vsl-pt",
      "whites": ["https://meusite.com/w1"]
    },
    "updated": {},
    "removed": {}
  },
  "counts": { "before": 0, "after": 2 },
  "siteUrls": {
    "domain": "meusite.com",
    "vsl": "https://meusite.com/vsl-pt",
    "whites": ["https://meusite.com/w1"]
  },
  "siteUrl": "https://meusite.com/vsl-pt"
}
```

**Use o response assim:**

- **`summary`**: texto pronto pra logar (ex: `console.log("[domains]", res.summary)`)
- **`delta.added/updated/removed`**: o que efetivamente mudou (útil pra dedup detection — se mandar a mesma white 2x, segunda vez vem `delta: {added:{}, ...}` indicando "nada novo")
- **`counts`**: quantos links a oferta tinha antes e depois — útil pra garantir que não inflou nada
- **`siteUrls`**: estado final no banco. Use pra confirmação.

---

## 6. Erros

| Status | Significado | Ação |
|---|---|---|
| `401` | Auth inválida | Verificar `CRON_SECRET` |
| `400` | Payload inválido (URL malformada, schema errado, etc) | Olhar `issues` no body — Zod retorna detalhes |
| `404` | Oferta não encontrada (id ou nome não bateu) | Listar ofertas no dashboard primeiro |
| `409` | `offerName` casou múltiplas | Resposta tem `candidates: [{id, name}]` — escolher e reenviar com `offerId` |
| `500` | Erro inesperado no servidor | Reportar pro Pedro |

### Exemplo de 409

```json
{
  "error": "Multiple offers match \"Mestre\". Use offerId.",
  "candidates": [
    { "id": 200, "name": "Mestre da cama" },
    { "id": 215, "name": "Mestre dos Mestres" }
  ]
}
```

---

## 7. Auditoria

Cada chamada gera um snapshot em `metrics_snapshots` com:
- `entityType: "site_urls_webhook"`
- `entityId: <offerId>`
- `extraData`: `{ offerId, merge, incoming, result, previousLinkCount, newLinkCount }`

Pra debug:
```sql
SELECT created_at, extra_data
FROM metrics_snapshots
WHERE entity_type = 'site_urls_webhook'
  AND entity_id = 201
ORDER BY created_at DESC
LIMIT 10;
```

---

## 8. Idempotência

- `merge=true` é **idempotente** pros casos comuns: chamar 2x com o mesmo payload não duplica whites/custom (dedup por URL).
- `vsl`/`quiz`/`domain` são singletons — sempre substituem.
- O webhook **não cria ofertas** — se a oferta não existe, retorna 404. Crie a oferta no dashboard antes.

---

## 8.5. Auto-trigger pattern (uma chamada por evento)

A premissa é: **toda vez que o agente externo terminar de criar UM artefato**, dispara uma chamada com APENAS o campo correspondente. Cumulativo (`merge=true` default), idempotente e legível.

Use sempre `offerId` (consultado via `GET /api/admin/offers` — seção 0).

**Antes de criar qualquer página, leia o que já existe**: `GET /api/admin/offers/lookup?id=<id>`
(seção 0.5) devolve o `siteUrls` inteiro. É o que evita recriar uma VSL que já está no ar e
perguntar de novo "qual era o domínio mesmo?".

| Evento (no agente externo) | Payload do POST | Resultado |
|---|---|---|
| **Comprou domínio raiz** (ex: `meusite.com`) | `{ "offerId": 201, "domain": "meusite.com" }` | `domain` definido |
| **Publicou VSL** | `{ "offerId": 201, "vsl": "https://meusite.com/vsl-pt" }` | VSL gravada + `siteCreated="SIM"` (na 1ª) |
| **Publicou 1 White** | `{ "offerId": 201, "whites": ["https://meusite.com/white-1"] }` | Acrescenta na lista (não substitui) |
| **Publicou múltiplas Whites de uma vez** | `{ "offerId": 201, "whites": ["...w1","...w2","...w3"] }` | Todas viram união com existentes |
| **Publicou Quiz** | `{ "offerId": 201, "quiz": "https://meusite.com/quiz-pt" }` | Quiz definido |
| **Configurou Pixel** | `{ "offerId": 201, "custom": [{"label":"Pixel","url":"..."}] }` | Adiciona em "Outros" |
| **Página de Obrigado** | `{ "offerId": 201, "custom": [{"label":"Obrigado","url":"..."}] }` | Adiciona em "Outros" |

**Vantagens deste padrão:**

- **Independência**: cada evento dispara a sua chamada separada — não precisa juntar/coordenar
- **Idempotência**: se o agente reentregar o mesmo evento (retry, reexecução), `merge=true` + dedup garante que não duplica
- **Auditoria granular**: cada chamada vira 1 row em `metrics_snapshots` — você sabe exatamente *quando* cada artefato entrou
- **Resposta dirigida**: `delta.added` te diz o que ESSA chamada mudou. Se o agente recebeu `added: {}` — nada novo, dedup pegou.

**Anti-padrão**: NÃO mandar tudo de uma vez ao final. Prejudica auditoria e idempotência.

```ts
// ❌ Ruim — sobrescreve tudo, perde rastro
await postWebhook({ offerId, vsl, whites, quiz, custom, merge: false });

// ✅ Bom — uma chamada por evento, cumulativo
await postWebhook({ offerId, vsl: newVsl });           // ao publicar VSL
await postWebhook({ offerId, whites: [newWhite] });    // ao publicar cada white
await postWebhook({ offerId, custom: [pixel] });       // ao configurar pixel
```

---

## 9. Boas práticas pro agente

1. **No boot da skill**: chame `GET /api/admin/offers` 1x e cacheie `Map<lowercase(name) → offerId>`. Resolve matches sem 409 ambíguo.
2. **Sempre use `offerId`** no POST (não `offerName`). Mais rápido, sem ambiguidade.
2.5. **Antes de criar página, LEIA**: `GET /api/admin/offers/lookup?id=<id>` (seção 0.5) devolve o `siteUrls` inteiro. O banco é a fonte da verdade sobre o que já está no ar — não o seu cache nem a memória da sessão anterior. Cheque `linkCount`, não `hasSiteUrls` sozinho.
3. **Uma chamada por evento** (seção 8.5): cada artefato criado dispara seu próprio POST com apenas o campo correspondente.
4. **Use `merge=true`** (default). `merge=false` só quando explicitamente refazendo setup do zero — perde rastro.
5. **Verifique `delta.added` na resposta**: se vier vazio, é dedup detectando que não mudou nada (esperado em retry).
6. **Loga `summary`**: vem pronto pra ser exibido (ex: `[domains] VSL adicionada, 2 whites adicionadas`).
7. **404 silencioso em batch**: se a oferta não está no banco (legado/não cadastrada), pula sem tratar como erro. Só logar `SKIPPED: not in DB`.
8. **Para pixel/obrigado/redirect** use `custom` com `label` descritivo. O dashboard mostra como `Label: URL` na seção "Outros".

---

## 10. Quick reference (TLDR)

```bash
# Ler o que a oferta JÁ tem (antes de criar qualquer coisa):
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://banco-de-dados-ngv.vercel.app/api/admin/offers/lookup?id=<ID DA OFERTA>"

# Não sabe o id? Busca por nome (409 se ambíguo, com as candidatas):
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://banco-de-dados-ngv.vercel.app/api/admin/offers/lookup?name=<TRECHO DO NOME>"

# Adicionar tudo de uma vez:
curl -X POST https://banco-de-dados-ngv.vercel.app/api/admin/offer-domains \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "offerName": "<NOME DA OFERTA>",
    "vsl": "https://<DOMINIO>/<SLUG VSL>",
    "whites": ["https://<DOMINIO>/<SLUG WHITE 1>", "https://<DOMINIO>/<SLUG WHITE 2>"],
    "quiz": "https://<DOMINIO>/<SLUG QUIZ>",
    "custom": [
      { "label": "Pixel", "url": "https://<DOMINIO>/<PIXEL>" },
      { "label": "Obrigado", "url": "https://<DOMINIO>/<OBRIGADO>" }
    ]
  }'
```

Cada chamada é independente — pode separar VSL, Whites, Quiz, Custom em chamadas distintas conforme cria as páginas. Tudo merge-friendly.
