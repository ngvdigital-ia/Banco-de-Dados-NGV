# Webhook: Atualizar domínios de oferta

Endpoint pro **agente Claude Code de criação de páginas** atualizar automaticamente os URLs de cada oferta no banco NGV Digital.

> **Versão**: 1.0 (Maio/2026)
> **Endpoint**: `POST https://banco-de-dados-ngv.vercel.app/api/admin/offer-domains`
> **Auth**: `Authorization: Bearer ${CRON_SECRET}`

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
  "siteUrls": {
    "domain": "meusite.com",
    "vsl": "https://meusite.com/vsl-pt",
    "whites": ["https://meusite.com/w1"],
    "quiz": "https://meusite.com/quiz-pt",
    "custom": [{ "label": "Obrigado", "url": "https://meusite.com/obrigado" }]
  },
  "siteUrl": "https://meusite.com/vsl-pt"
}
```

`siteUrls` é o estado **final** após o merge. Use isso pra confirmar.

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

## 9. Boas práticas pro agente

1. **Sempre prefira `offerId`** quando souber. Mais rápido, sem risco de 409.
2. **Use `merge=true`** (default) na maioria dos casos. Só use `merge=false` quando explicitamente refazendo setup.
3. **Verifique a resposta**: o `siteUrls` retornado é o estado final. Se algo não bateu, ajuste e reenvie.
4. **Não envie campos vazios** desnecessariamente. Ex: se só está adicionando whites, não mande `vsl`/`quiz`/`domain` — só passa `{ offerName, whites }`.
5. **Para criar pixel/obrigado/redirect** use `custom` com `label` descritivo. O dashboard mostra como `Label: URL` na seção "Outros".
6. **Em caso de erro 404**: a oferta provavelmente não existe ainda. Pedro precisa criar no dashboard antes (ou você pode pedir que ele crie).

---

## 10. Quick reference (TLDR)

```bash
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
