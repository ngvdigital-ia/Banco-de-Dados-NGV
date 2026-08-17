-- read_apps_lookup_by_email — resolve e-mail → acesso do cliente LENDO SÓ DO NGV CORE.
--
-- Por que existe: o painel Banco NGV precisa responder "esse e-mail comprou o quê?" sem
-- abrir conexão com o Supabase Apps. O Core já consegue responder sozinho: `auth.users`
-- dele tem os 2344 usuários e as tabelas espelho `ngv_apps.*` resolvem 110/110 acessos e
-- 102/102 compras para um usuário do Core (zero órfãos, medido em 17/08/2026).
--
-- REGRA DURA DE PII — o e-mail ENTRA e NÃO SAI:
--   * o jsonb devolvido não carrega e-mail, nome, CPF, telefone, token nem access_token;
--   * carrega apenas slugs, chaves de produto, ids de pedido/produto e timestamps;
--   * os identificadores de pessoa (core_user_id, legacy_user_id, legacy_access_id,
--     subject_id) são DESCARTADOS de propósito — o painel não usa nenhum deles, e o
--     `resolved` booleano já responde "existe/não existe" sem devolver o uuid do
--     auth.users de nenhum dos 2344 usuários do Core.
--
-- E-mail que não resolve NÃO é erro: devolve
--   {"resolved": false, "access": [], "purchases": [], "products": []}
-- — mesma forma de um e-mail que resolve mas não comprou nada, então a resposta não
-- serve de oráculo de enumeração de cadastro.
--
-- Estilo copiado de public.find_ngv_core_user_by_email (LANGUAGE sql STABLE SECURITY
-- DEFINER com search_path fixo). Todas as referências são qualificadas (auth.users,
-- ngv_apps.*), então `search_path` fica só com pg_catalog.

create or replace function public.read_apps_lookup_by_email(p_email text)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog'
as $function$
  with subject as (
    select id
    from auth.users
    where lower(email) = lower(trim(p_email))
    limit 1
  )
  select jsonb_build_object(
    'resolved', exists (select 1 from subject),

    'access', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'offer_slug', ua.offer_slug,
          'status', ua.status,
          'origin_created_at', ua.origin_created_at,
          'origin_updated_at', ua.origin_updated_at,
          'migrated_at', ua.migrated_at
        )
        order by ua.origin_created_at, ua.offer_slug
      )
      from ngv_apps.user_access ua
      join subject s on s.id = ua.core_user_id
    ), '[]'::jsonb),

    'purchases', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'order_id', pe.order_id,
          'product_id', pe.product_id,
          'product_key', pe.product_key,
          'offer_slug', pe.offer_slug,
          'catalog_group', pe.catalog_group,
          'event_type', pe.event_type,
          'amount_cents', pe.amount_cents,
          'gateway', pe.gateway,
          'source_event_at', pe.source_event_at,
          'received_at', pe.received_at
        )
        order by coalesce(pe.source_event_at, pe.received_at) desc, pe.id desc
      )
      from ngv_apps.purchase_events pe
      join subject s on s.id = pe.subject_id
    ), '[]'::jsonb),

    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'offer_slug', pgs.offer_slug,
          'product_key', pgs.product_key,
          'title', co.title,
          'status', pgs.status,
          'updated_at', pgs.updated_at
        )
        order by pgs.offer_slug, pgs.product_key
      )
      from ngv_apps.product_grant_state pgs
      join subject s on s.id = pgs.subject_id
      left join ngv_apps.catalog_offers co on co.offer_slug = pgs.offer_slug
    ), '[]'::jsonb)
  )
$function$;

comment on function public.read_apps_lookup_by_email(text) is
  'Lookup de acesso do cliente por e-mail para o painel Banco NGV. O e-mail entra e nao sai: o jsonb devolvido nao contem e-mail, nome, CPF, telefone, token nem os uuids de pessoa. E-mail sem correspondencia devolve resolved=false com arrays vazios (nunca erro).';

-- Só o service_role (edge function apps-lookup-read) executa. PUBLIC ganha EXECUTE por
-- padrão no CREATE FUNCTION — sem o REVOKE abaixo, anon/authenticated conseguiriam
-- consultar acesso de qualquer cliente pelo PostgREST.
revoke all on function public.read_apps_lookup_by_email(text) from public;
revoke all on function public.read_apps_lookup_by_email(text) from anon, authenticated;
grant execute on function public.read_apps_lookup_by_email(text) to service_role;
