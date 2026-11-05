-- THE SEVEN CLUB · interações das empresas e vencimento de assinaturas

-- Interações recebidas pelas publicações de uma empresa (só para quem administra a empresa ou a equipe do clube).
-- Roda com as permissões de quem chama: só conta o que as regras de acesso já deixam ver.
create or replace function public.business_insights(p_business uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  since timestamptz := now() - interval '30 days';
begin
  if not (public.is_business_admin(p_business) or public.is_staff('admin')) then
    return null;
  end if;
  return jsonb_build_object(
    'posts_total', (select count(*) from public.posts p where p.business_id = p_business),
    'posts_30d', (select count(*) from public.posts p where p.business_id = p_business and p.created_at >= since),
    'likes_30d', (select count(*) from public.likes l join public.posts p on p.id = l.post_id
                   where p.business_id = p_business and l.created_at >= since),
    'comments_30d', (select count(*) from public.comments c join public.posts p on p.id = c.post_id
                      where p.business_id = p_business and c.created_at >= since and c.hidden_at is null),
    'people_30d', (select count(distinct x.member_id) from (
                      select l.member_id from public.likes l join public.posts p on p.id = l.post_id
                       where p.business_id = p_business and l.created_at >= since
                      union
                      select c.author_id from public.comments c join public.posts p on p.id = c.post_id
                       where p.business_id = p_business and c.created_at >= since and c.hidden_at is null) x),
    'recent_comments', coalesce((
      select jsonb_agg(r order by r->>'created_at' desc) from (
        select jsonb_build_object('id', c.id, 'post_id', c.post_id, 'body', left(c.body, 160), 'created_at', c.created_at,
                                  'author', public.member_card(c.author_id)) r
        from public.comments c join public.posts p on p.id = c.post_id
        where p.business_id = p_business and c.hidden_at is null
        order by c.created_at desc limit 5) t), '[]'::jsonb)
  );
end $$;
grant execute on function public.business_insights(uuid) to authenticated;

-- Assinatura com data de término vencida passa a "pendente" (past_due). A equipe decide o acesso em Integrantes.
create or replace function public.expire_memberships()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.memberships set status = 'past_due'
   where status in ('active', 'trial') and ends_at is not null and ends_at < public.club_today();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.expire_memberships() from public, anon, authenticated;
grant execute on function public.expire_memberships() to service_role;
