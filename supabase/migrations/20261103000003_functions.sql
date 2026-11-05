-- THE SEVEN CLUB · funções
-- Leituras do app em uma chamada (SECURITY INVOKER: respeitam RLS), convites, afirmações,
-- notificações e painel administrativo.

-- ---------------------------------------------------------------- utilitários
create or replace function public.like_term(t text)
returns text language sql immutable set search_path = '' as $$
  select '%' || regexp_replace(t, '([%_\\])', '\\\1', 'g') || '%'
$$;

create or replace function public.search_terms(q text)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(t), '{}') from unnest(regexp_split_to_array(public.f_norm(coalesce(q, '')), '\s+')) t
  where char_length(t) >= 2
$$;

-- texto normalizado bate com todos os termos
create or replace function public.matches_all(haystack text, terms text[])
returns boolean language sql immutable set search_path = '' as $$
  select not exists (select 1 from unnest(terms) t where haystack not like public.like_term(t))
$$;

create or replace function public.member_card(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'handle', p.handle, 'full_name', p.full_name,
    'avatar_path', p.avatar_path, 'headline', p.headline
  )
  from public.profiles p
  where p.id = p_id and public.is_member()
$$;

-- ---------------------------------------------------------------- convites
create or replace function public.invitation_lookup(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'email', i.email,
    'valid', i.accepted_at is null and i.revoked_at is null and i.expires_at > now(),
    'expired', i.expires_at <= now(),
    'used', i.accepted_at is not null
  )
  from public.invitations i where i.token = p_token
$$;

create or replace function public.handle_available(p_handle text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_handle ~ '^[a-z0-9_.]{3,30}$' and not exists (select 1 from public.profiles where handle = p_handle)
$$;

create or replace function public.accept_invitation(p_token text, p_full_name text, p_handle text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select * into inv from public.invitations where token = p_token for update;
  if inv.id is null or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at <= now() then
    raise exception 'Convite inválido ou expirado' using errcode = '22023';
  end if;
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> inv.email then
    raise exception 'Este convite é para outro e-mail' using errcode = '42501';
  end if;
  if exists (select 1 from public.members where id = uid) then
    raise exception 'Você já é integrante' using errcode = '23505';
  end if;
  if not public.handle_available(p_handle) then
    raise exception 'Esse @ já está em uso ou é inválido' using errcode = '23505';
  end if;

  insert into public.members (id, role, invited_by) values (uid, inv.role, inv.created_by);
  insert into public.profiles (id, handle, full_name) values (uid, p_handle, trim(p_full_name));
  insert into public.user_preferences (member_id) values (uid);
  insert into public.memberships (member_id, plan, status) values (uid, inv.plan, 'active');
  update public.invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  insert into public.audit_log (actor_id, action, target_type, target_id) values (uid, 'invitation.accept', 'invitation', inv.id::text);
  return uid;
end $$;

-- Sessão atual: quem sou, papel e contadores do cabeçalho
create or replace function public.me()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'role', m.role, 'status', m.status,
    'handle', p.handle, 'full_name', p.full_name, 'avatar_path', p.avatar_path,
    'unread', (select count(*) from public.notifications n where n.recipient_id = m.id and n.read_at is null)
  )
  from public.members m join public.profiles p on p.id = m.id
  where m.id = auth.uid()
$$;

-- ---------------------------------------------------------------- feed
create or replace function public.posts_json(p_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.ord), '[]'::jsonb) from (
    select o.ord, jsonb_build_object(
      'id', p.id, 'body', p.body, 'created_at', p.created_at, 'edited_at', p.edited_at,
      'context', p.context, 'source', p.source, 'hidden', p.hidden_at is not null,
      'author', public.member_card(p.author_id),
      'business', (select jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'logo_path', b.logo_path)
                   from public.businesses b where b.id = p.business_id),
      'project', (select jsonb_build_object('id', pr.id, 'slug', pr.slug, 'name', pr.name, 'visibility', pr.visibility)
                  from public.projects pr where pr.id = p.project_id),
      'pillar', (select jsonb_build_object('slug', pl.slug, 'name', pl.name) from public.pillars pl where pl.id = p.pillar_id),
      'affirmation', (select jsonb_build_object('text', a.text, 'theme', a.theme) from public.affirmations a where a.id = p.affirmation_id),
      'media', coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'width', m.width, 'height', m.height) order by m.position)
                         from public.post_media m where m.post_id = p.id), '[]'::jsonb),
      'like_count', (select count(*) from public.likes l where l.post_id = p.id),
      'comment_count', (select count(*) from public.comments c where c.post_id = p.id and c.hidden_at is null),
      'liked', exists (select 1 from public.likes l where l.post_id = p.id and l.member_id = auth.uid()),
      'saved', exists (select 1 from public.saved_posts s where s.post_id = p.id and s.member_id = auth.uid()),
      'mine', p.author_id = auth.uid(),
      'can_moderate', public.is_staff('moderator')
    ) as j
    from unnest(p_ids) with ordinality as o(id, ord)
    join public.posts p on p.id = o.id
  ) x
$$;

create or replace function public.feed_page(
  p_scope text default 'all',
  p_business uuid default null,
  p_project uuid default null,
  p_author uuid default null,
  p_post uuid default null,
  p_cursor_ts timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 15
)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  ids uuid[];
  lim int := least(greatest(coalesce(p_limit, 15), 1), 50);
begin
  select array_agg(t.id order by t.created_at desc, t.id desc) into ids
  from (
    select p.id, p.created_at
    from public.posts p
    where (p_post is null or p.id = p_post)
      and (p_business is null or p.business_id = p_business)
      and (p_project is null or p.project_id = p_project)
      and (p_author is null or (p.author_id = p_author and p.context = 'member'))
      and case coalesce(p_scope, 'all')
            when 'members' then p.context = 'member' and p.source <> 'seven'
            when 'businesses' then p.context = 'business'
            when 'projects' then p.context = 'project'
            when 'seven' then p.source = 'seven'
            when 'saved' then exists (select 1 from public.saved_posts s where s.post_id = p.id and s.member_id = auth.uid())
            else true
          end
      and (p_post is not null or p.hidden_at is null)
      and not public.is_blocked_between(auth.uid(), p.author_id)
      and (p_cursor_ts is null or (p.created_at, p.id) < (p_cursor_ts, p_cursor_id))
    order by p.created_at desc, p.id desc
    limit lim
  ) t;
  return public.posts_json(coalesce(ids, '{}'));
end $$;

create or replace function public.post_comments(p_post uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'body', c.body, 'created_at', c.created_at, 'hidden', c.hidden_at is not null,
    'author', public.member_card(c.author_id), 'mine', c.author_id = auth.uid(),
    'can_moderate', public.is_staff('moderator')
  ) order by c.created_at), '[]'::jsonb)
  from public.comments c
  where c.post_id = p_post and not public.is_blocked_between(auth.uid(), c.author_id)
$$;

-- ---------------------------------------------------------------- perfis
create or replace function public.profile_page(p_handle text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'handle', p.handle, 'full_name', p.full_name, 'headline', p.headline, 'bio', p.bio,
    'city', p.city, 'interests', p.interests, 'avatar_path', p.avatar_path, 'instagram', p.instagram,
    'website', p.website, 'member_since', m.created_at, 'role', m.role,
    'is_me', p.id = auth.uid(),
    'blocked_by_me', exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.id),
    'post_count', (select count(*) from public.posts x where x.author_id = p.id and x.context = 'member' and x.hidden_at is null),
    'businesses', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'tagline', b.tagline,
                                          'logo_path', b.logo_path, 'role', ba.role) order by b.name)
      from public.business_admins ba join public.businesses b on b.id = ba.business_id
      where ba.member_id = p.id), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'slug', pr.slug, 'name', pr.name, 'category', pr.category,
                                          'cover_path', pr.cover_path, 'visibility', pr.visibility, 'role', pm.role) order by pr.created_at desc)
      from public.project_members pm join public.projects pr on pr.id = pm.project_id
      where pm.member_id = p.id), '[]'::jsonb)
  )
  from public.profiles p join public.members m on m.id = p.id
  where p.handle = p_handle and m.status = 'active'
$$;

-- ---------------------------------------------------------------- negócios
create or replace function public.business_card(b public.businesses)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'slug', b.slug, 'name', b.name, 'tagline', b.tagline, 'logo_path', b.logo_path,
    'cover_path', b.cover_path, 'city', b.city, 'featured', b.featured,
    'category', (select jsonb_build_object('slug', c.slug, 'name', c.name) from public.business_categories c where c.id = b.category_id),
    'owner', public.member_card(b.owner_id)
  )
$$;

create or replace function public.businesses_list(
  p_category text default null,
  p_q text default null,
  p_featured boolean default null,
  p_mine boolean default false,
  p_offset int default 0,
  p_limit int default 20
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with terms as (select public.search_terms(p_q) as t)
  select coalesce(jsonb_agg(public.business_card(x) order by x.featured desc, x.name), '[]'::jsonb)
  from (
    select b.* from public.businesses b, terms
    where b.hidden_at is null
      and (p_category is null or b.category_id = (select c.id from public.business_categories c where c.slug = p_category))
      and (p_featured is null or b.featured = p_featured)
      and (not coalesce(p_mine, false) or public.is_business_admin(b.id))
      and (cardinality(terms.t) = 0 or public.matches_all(
            b.search_text || ' ' ||
            coalesce((select string_agg(o.search_text, ' ') from public.business_offerings o where o.business_id = b.id), '') || ' ' ||
            coalesce((select pr.search_text from public.profiles pr where pr.id = b.owner_id), '') || ' ' ||
            coalesce((select public.f_norm(c.name) from public.business_categories c where c.id = b.category_id), ''),
            terms.t))
    order by b.featured desc, b.name
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ) x
$$;

create or replace function public.business_page(p_slug text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.business_card(b) || jsonb_build_object(
    'description', b.description, 'instagram', b.instagram, 'website', b.website, 'whatsapp', b.whatsapp,
    'address', b.address, 'service_area', b.service_area, 'category_id', b.category_id, 'hidden', b.hidden_at is not null,
    'can_edit', public.is_business_admin(b.id) or public.is_staff('admin'),
    'is_owner', public.is_business_owner(b.id),
    'admins', coalesce((select jsonb_agg(public.member_card(ba.member_id) || jsonb_build_object('role', ba.role) order by ba.role, ba.created_at)
                        from public.business_admins ba where ba.business_id = b.id), '[]'::jsonb),
    'offerings', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'name', o.name,
                            'description', o.description, 'price_text', o.price_text) order by o.kind, o.position, o.created_at)
                          from public.business_offerings o where o.business_id = b.id), '[]'::jsonb),
    'media', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.path, 'width', m.width, 'height', m.height) order by m.position, m.created_at)
                       from public.business_media m where m.business_id = b.id), '[]'::jsonb)
  )
  from public.businesses b where b.slug = p_slug
$$;

-- ---------------------------------------------------------------- projetos
create or replace function public.projects_list(
  p_q text default null,
  p_member uuid default null,
  p_offset int default 0,
  p_limit int default 20
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with terms as (select public.search_terms(p_q) as t)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'slug', x.slug, 'name', x.name, 'description', left(x.description, 180), 'category', x.category,
    'visibility', x.visibility, 'cover_path', x.cover_path, 'owner', public.member_card(x.owner_id),
    'member_count', (select count(*) from public.project_members pm where pm.project_id = x.id)
  ) order by x.created_at desc), '[]'::jsonb)
  from (
    select pr.* from public.projects pr, terms
    where pr.hidden_at is null
      and (p_member is null or exists (select 1 from public.project_members pm where pm.project_id = pr.id and pm.member_id = p_member))
      and (cardinality(terms.t) = 0 or public.matches_all(pr.search_text, terms.t))
    order by pr.created_at desc
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ) x
$$;

create or replace function public.project_page(p_slug text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', pr.id, 'slug', pr.slug, 'name', pr.name, 'description', pr.description, 'category', pr.category,
    'visibility', pr.visibility, 'cover_path', pr.cover_path, 'created_at', pr.created_at, 'hidden', pr.hidden_at is not null,
    'owner', public.member_card(pr.owner_id),
    'is_owner', public.is_project_owner(pr.id),
    'is_member', public.is_project_member(pr.id),
    'can_edit', public.is_project_owner(pr.id) or public.is_staff('admin'),
    'members', coalesce((select jsonb_agg(public.member_card(pm.member_id) || jsonb_build_object('role', pm.role) order by pm.role, pm.created_at)
                         from public.project_members pm where pm.project_id = pr.id), '[]'::jsonb)
  )
  from public.projects pr where pr.slug = p_slug
$$;

-- ---------------------------------------------------------------- SEVEN
create or replace function public.seven_day(p_day date default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pl.id, 'slug', pl.slug, 'name', pl.name, 'description', pl.description, 'prompt', pl.prompt,
    'check_in', (select jsonb_build_object('id', c.id, 'completed_at', c.completed_at, 'note', c.note,
                                           'photo_path', c.photo_path, 'activity_id', c.activity_id,
                                           'shared', exists (select 1 from public.posts p where p.check_in_id = c.id))
                 from public.check_ins c
                 where c.member_id = auth.uid() and c.pillar_id = pl.id and c.day = coalesce(p_day, public.club_today())),
    'activities', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'mine', a.member_id is not null)
                                             order by a.member_id nulls first, a.created_at)
                            from public.daily_activities a
                            where a.pillar_id = pl.id and a.active and (a.member_id is null or a.member_id = auth.uid())), '[]'::jsonb)
  ) order by pl.position), '[]'::jsonb)
  from public.pillars pl
$$;

create or replace function public.seven_overview(p_month date default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  today date := public.club_today();
  m_start date := date_trunc('month', coalesce(p_month, today))::date;
  m_end date := (date_trunc('month', coalesce(p_month, today)) + interval '1 month - 1 day')::date;
  streak int := 0;
  best int := 0;
begin
  -- sequência atual: dias seguidos com ao menos um pilar concluído, até hoje (ou ontem)
  with days as (
    select distinct day from public.check_ins where member_id = auth.uid() and completed_at is not null
  ), islands as (
    select day, day - (row_number() over (order by day))::int as grp from days
  ), runs as (
    select min(day) as first_day, max(day) as last_day, count(*)::int as len from islands group by grp
  )
  select coalesce(max(len) filter (where last_day >= today - 1), 0), coalesce(max(len), 0)
  into streak, best from runs;

  return jsonb_build_object(
    'today', today,
    'month', m_start,
    'streak', streak,
    'best_streak', best,
    'calendar', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'done', coalesce(x.n, 0)) order by d)
      from generate_series(m_start, m_end, interval '1 day') d
      left join (select day, count(*) as n from public.check_ins
                 where member_id = auth.uid() and completed_at is not null and day between m_start and m_end
                 group by day) x on x.day = d::date), '[]'::jsonb),
    'pillars', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', pl.slug, 'name', pl.name,
        'week', (select count(*) from public.check_ins c where c.member_id = auth.uid() and c.pillar_id = pl.id
                  and c.completed_at is not null and c.day between today - 6 and today),
        'month', (select count(*) from public.check_ins c where c.member_id = auth.uid() and c.pillar_id = pl.id
                  and c.completed_at is not null and c.day between m_start and m_end),
        'total', (select count(*) from public.check_ins c where c.member_id = auth.uid() and c.pillar_id = pl.id
                  and c.completed_at is not null)
      ) order by pl.position) from public.pillars pl), '[]'::jsonb),
    'weeks', coalesce((
      select jsonb_agg(jsonb_build_object('week_start', w::date, 'done', (
        select count(*) from public.check_ins c where c.member_id = auth.uid() and c.completed_at is not null
        and c.day between w::date and w::date + 6)) order by w)
      from generate_series(date_trunc('week', today::timestamp) - interval '7 weeks', date_trunc('week', today::timestamp), interval '1 week') w
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.seven_history(p_pillar text default null, p_before date default null, p_limit int default 30)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'day', c.day, 'completed_at', c.completed_at, 'note', c.note, 'photo_path', c.photo_path,
    'pillar', jsonb_build_object('slug', pl.slug, 'name', pl.name),
    'activity', (select a.title from public.daily_activities a where a.id = c.activity_id),
    'shared', exists (select 1 from public.posts p where p.check_in_id = c.id)
  ) order by c.day desc, pl.position), '[]'::jsonb)
  from (
    select * from public.check_ins c
    where c.member_id = auth.uid() and c.completed_at is not null
      and (p_pillar is null or c.pillar_id = (select id from public.pillars where slug = p_pillar))
      and (p_before is null or c.day < p_before)
    order by c.day desc
    limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) c
  join public.pillars pl on pl.id = c.pillar_id
$$;

-- ---------------------------------------------------------------- afirmações
-- Seleção sem repetição: percorre a biblioteca publicada inteira antes de recomeçar um ciclo
create or replace function public.ensure_affirmation(p_day date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  pick uuid;
  cyc int;
  prev uuid;
begin
  select affirmation_id into pick from public.affirmation_schedule where day = p_day;
  if pick is not null then return pick; end if;

  perform pg_advisory_xact_lock(hashtext('seven.affirmation'));
  select affirmation_id into pick from public.affirmation_schedule where day = p_day;
  if pick is not null then return pick; end if;

  select coalesce(max(cycle), 1) into cyc from public.affirmation_schedule;
  select affirmation_id into prev from public.affirmation_schedule where day = p_day - 1;

  select a.id into pick from public.affirmations a
  where a.status = 'published'
    and not exists (select 1 from public.affirmation_schedule s where s.affirmation_id = a.id and s.cycle = cyc)
  order by random() limit 1;

  if pick is null then
    cyc := cyc + 1;
    select a.id into pick from public.affirmations a
    where a.status = 'published' and a.id is distinct from prev
    order by random() limit 1;
  end if;
  if pick is null then return null; end if;

  insert into public.affirmation_schedule (day, affirmation_id, cycle, source) values (p_day, pick, cyc, 'auto');
  return pick;
end $$;

create or replace function public.affirmation_today()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  today date := public.club_today();
  aid uuid;
begin
  if not public.is_member() then return null; end if;
  aid := public.ensure_affirmation(today);
  if aid is null then return null; end if;
  return (
    select jsonb_build_object('id', a.id, 'text', a.text, 'theme', a.theme, 'day', today,
      'favorited', exists (select 1 from public.affirmation_favorites f where f.affirmation_id = a.id and f.member_id = auth.uid()),
      'shared', exists (select 1 from public.posts p where p.affirmation_id = a.id and p.author_id = auth.uid()))
    from public.affirmations a where a.id = aid
  );
end $$;

create or replace function public.affirmations_history(p_before date default null, p_limit int default 30)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'day', s.day, 'id', a.id, 'text', a.text, 'theme', a.theme,
    'favorited', exists (select 1 from public.affirmation_favorites f where f.affirmation_id = a.id and f.member_id = auth.uid())
  ) order by s.day desc), '[]'::jsonb)
  from (
    select * from public.affirmation_schedule
    where day <= public.club_today() and (p_before is null or day < p_before)
    order by day desc limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) s
  join public.affirmations a on a.id = s.affirmation_id
$$;

create or replace function public.affirmations_favorites()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'text', a.text, 'theme', a.theme, 'favorited', true,
    'day', (select max(s.day) from public.affirmation_schedule s where s.affirmation_id = a.id and s.day <= public.club_today()))
    order by f.created_at desc), '[]'::jsonb)
  from public.affirmation_favorites f join public.affirmations a on a.id = f.affirmation_id
  where f.member_id = auth.uid()
$$;

create or replace function public.schedule_affirmation(p_day date, p_affirmation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cyc int;
begin
  if not public.is_staff('admin') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if p_day < public.club_today() then raise exception 'Não é possível alterar dias passados' using errcode = '22023'; end if;
  if not exists (select 1 from public.affirmations where id = p_affirmation and status = 'published') then
    raise exception 'Publique a afirmação antes de agendar' using errcode = '22023';
  end if;
  select coalesce(max(cycle), 1) into cyc from public.affirmation_schedule;
  insert into public.affirmation_schedule (day, affirmation_id, cycle, source)
  values (p_day, p_affirmation, cyc, 'manual')
  on conflict (day) do update set affirmation_id = excluded.affirmation_id, source = 'manual';
end $$;

-- ---------------------------------------------------------------- agenda
create or replace function public.event_json(e public.events)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'title', e.title, 'description', e.description, 'kind', e.kind, 'starts_at', e.starts_at,
    'ends_at', e.ends_at, 'location', e.location, 'cover_path', e.cover_path, 'capacity', e.capacity,
    'published', e.published, 'show_attendees', e.show_attendees,
    'online_url', case when exists (select 1 from public.event_registrations r where r.event_id = e.id and r.member_id = auth.uid() and r.status <> 'cancelled')
                         or public.is_staff('admin') then e.online_url end,
    'has_online_url', e.online_url is not null,
    'taken', (select count(*) from public.event_registrations r where r.event_id = e.id and r.status <> 'cancelled'),
    'my_status', (select r.status from public.event_registrations r where r.event_id = e.id and r.member_id = auth.uid())
  )
$$;

create or replace function public.events_list(p_scope text default 'upcoming', p_limit int default 30)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(public.event_json(e) order by
    case when p_scope = 'past' then null else e.starts_at end asc,
    case when p_scope = 'past' then e.starts_at end desc), '[]'::jsonb)
  from (
    select * from public.events e
    where e.published
      and case p_scope
            when 'past' then coalesce(e.ends_at, e.starts_at) < now()
            when 'mine' then exists (select 1 from public.event_registrations r where r.event_id = e.id and r.member_id = auth.uid() and r.status <> 'cancelled')
            else coalesce(e.ends_at, e.starts_at + interval '3 hours') >= now()
          end
    order by case when p_scope = 'past' then null else e.starts_at end asc,
             case when p_scope = 'past' then e.starts_at end desc
    limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) e
$$;

create or replace function public.event_detail(p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.event_json(e) || jsonb_build_object(
    'attendees', case when e.show_attendees or public.is_staff('admin') then coalesce((
      select jsonb_agg(public.member_card(r.member_id) || jsonb_build_object('status', r.status) order by r.created_at)
      from public.event_registrations r where r.event_id = e.id and r.status <> 'cancelled'), '[]'::jsonb) end
  )
  from public.events e where e.id = p_id
$$;

-- ---------------------------------------------------------------- busca global
create or replace function public.search_all(p_q text, p_kind text default 'all', p_limit int default 6)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  t text[] := public.search_terms(p_q);
  lim int := least(greatest(coalesce(p_limit, 6), 1), 40);
  out jsonb := '{}'::jsonb;
begin
  if cardinality(t) = 0 then return out; end if;

  if p_kind in ('all', 'members') then
    out := out || jsonb_build_object('members', coalesce((
      select jsonb_agg(public.member_card(x.id)) from (
        select p.id from public.profiles p join public.members m on m.id = p.id and m.status = 'active'
        where public.matches_all(p.search_text || ' ' || public.f_norm(array_to_string(p.interests, ' ')), t)
          and not public.is_blocked_between(auth.uid(), p.id)
        order by p.full_name limit lim) x), '[]'::jsonb));
  end if;

  if p_kind in ('all', 'businesses') then
    out := out || jsonb_build_object('businesses', public.businesses_list(null, p_q, null, false, 0, lim));
  end if;

  if p_kind in ('all', 'offerings') then
    out := out || jsonb_build_object('offerings', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'name', o.name, 'price_text', o.price_text,
                                          'business', jsonb_build_object('slug', b.slug, 'name', b.name, 'logo_path', b.logo_path)))
      from (select o.* from public.business_offerings o
            join public.businesses b on b.id = o.business_id and b.hidden_at is null
            where public.matches_all(o.search_text, t) order by o.name limit lim) o
      join public.businesses b on b.id = o.business_id), '[]'::jsonb));
  end if;

  if p_kind in ('all', 'projects') then
    out := out || jsonb_build_object('projects', public.projects_list(p_q, null, 0, lim));
  end if;

  if p_kind in ('all', 'posts') then
    out := out || jsonb_build_object('posts', public.posts_json(coalesce((
      select array_agg(x.id order by x.created_at desc) from (
        select p.id, p.created_at from public.posts p
        where p.hidden_at is null and public.matches_all(p.search_text, t)
          and not public.is_blocked_between(auth.uid(), p.author_id)
        order by p.created_at desc limit lim) x), '{}')));
  end if;

  if p_kind in ('all', 'events') then
    out := out || jsonb_build_object('events', coalesce((
      select jsonb_agg(public.event_json(e) order by e.starts_at desc) from (
        select * from public.events e where e.published and public.matches_all(e.search_text, t)
        order by e.starts_at desc limit lim) e), '[]'::jsonb));
  end if;

  return out;
end $$;

-- ---------------------------------------------------------------- notificações
create or replace function public.notify(
  p_recipient uuid, p_actor uuid, p_kind public.notification_kind,
  p_title text, p_body text, p_link text,
  p_post uuid default null, p_project uuid default null, p_event uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pref public.user_preferences;
begin
  if p_recipient is null or p_recipient = p_actor then return; end if;
  if not exists (select 1 from public.members where id = p_recipient and status = 'active') then return; end if;
  if p_actor is not null and public.is_blocked_between(p_recipient, p_actor) then return; end if;
  select * into pref from public.user_preferences where member_id = p_recipient;
  if pref.member_id is not null then
    if (p_kind = 'like' and not pref.notify_likes)
       or (p_kind = 'comment' and not pref.notify_comments)
       or (p_kind = 'mention' and not pref.notify_mentions)
       or (p_kind = 'project_invite' and not pref.notify_projects)
       or (p_kind in ('event', 'event_reminder') and not pref.notify_events)
       or (p_kind = 'affirmation' and not pref.notify_affirmation)
       or (p_kind = 'seven_reminder' and not pref.notify_seven_reminder) then
      return;
    end if;
  end if;
  insert into public.notifications (recipient_id, actor_id, kind, title, body, link, post_id, project_id, event_id)
  values (p_recipient, p_actor, p_kind, p_title, p_body, p_link, p_post, p_project, p_event);
end $$;

create or replace function public.display_name(p_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select full_name from public.profiles where id = p_id
$$;

create or replace function public.notify_mentions(p_body text, p_actor uuid, p_post uuid, p_project uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  h text;
  rid uuid;
begin
  for h in select distinct m[1] from regexp_matches(coalesce(p_body, ''), '@([a-z0-9_.]{3,30})', 'g') as m loop
    select id into rid from public.profiles where handle = h;
    if rid is null then continue; end if;
    if p_project is not null and not exists (
      select 1 from public.projects pr where pr.id = p_project
      and (pr.visibility = 'club' or exists (select 1 from public.project_members pm where pm.project_id = pr.id and pm.member_id = rid))
    ) then continue; end if;
    perform public.notify(rid, p_actor, 'mention', 'Você foi mencionada',
      public.display_name(p_actor) || ' mencionou você', '/post/' || p_post, p_post);
  end loop;
end $$;

create or replace function public.on_like()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  if exists (select 1 from public.notifications where recipient_id = author and actor_id = new.member_id
             and post_id = new.post_id and kind = 'like' and created_at > now() - interval '1 day') then
    return new;
  end if;
  perform public.notify(author, new.member_id, 'like', 'Nova curtida',
    public.display_name(new.member_id) || ' curtiu sua publicação', '/post/' || new.post_id, new.post_id);
  return new;
end $$;

create trigger likes_notify after insert on public.likes for each row execute function public.on_like();

create or replace function public.on_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  post public.posts;
begin
  select * into post from public.posts where id = new.post_id;
  perform public.notify(post.author_id, new.author_id, 'comment', 'Novo comentário',
    public.display_name(new.author_id) || ': ' || left(new.body, 120), '/post/' || new.post_id, new.post_id);
  perform public.notify_mentions(new.body, new.author_id, new.post_id, post.project_id);
  return new;
end $$;

create trigger comments_notify after insert on public.comments for each row execute function public.on_comment();

create or replace function public.on_post()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_mentions(new.body, new.author_id, new.id, new.project_id);
  return new;
end $$;

create trigger posts_notify after insert on public.posts for each row execute function public.on_post();

create or replace function public.on_project_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pr public.projects;
begin
  if new.role <> 'collaborator' then return new; end if;
  select * into pr from public.projects where id = new.project_id;
  perform public.notify(new.member_id, new.added_by, 'project_invite', 'Convite para projeto',
    public.display_name(new.added_by) || ' adicionou você ao projeto ' || pr.name,
    '/projetos/' || pr.slug, null, pr.id);
  return new;
end $$;

create trigger project_members_notify after insert on public.project_members for each row execute function public.on_project_member();

create or replace function public.notifications_list(p_before timestamptz default null, p_limit int default 30)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body, 'link', n.link,
    'read', n.read_at is not null, 'created_at', n.created_at,
    'actor', case when n.actor_id is not null then public.member_card(n.actor_id) end
  ) order by n.created_at desc), '[]'::jsonb)
  from (
    select * from public.notifications
    where recipient_id = auth.uid() and (p_before is null or created_at < p_before)
    order by created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) n
$$;

-- Rotinas agendadas (chamadas pelo cron com a chave de serviço)
create or replace function public.queue_daily_affirmations()
returns int language plpgsql security definer set search_path = '' as $$
declare
  today date := public.club_today();
  now_local time := (now() at time zone 'America/Sao_Paulo')::time;
  aff public.affirmations;
  n int := 0;
  r record;
begin
  select a.* into aff from public.affirmations a where a.id = public.ensure_affirmation(today);
  if aff.id is null then return 0; end if;
  for r in
    select up.member_id from public.user_preferences up
    join public.members m on m.id = up.member_id and m.status = 'active'
    where up.notify_affirmation and up.affirmation_time <= now_local
      and not exists (select 1 from public.notifications n where n.recipient_id = up.member_id and n.kind = 'affirmation'
                      and (n.created_at at time zone 'America/Sao_Paulo')::date = today)
  loop
    perform public.notify(r.member_id, null, 'affirmation', 'Afirmação do dia', aff.text, '/afirmacoes');
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.queue_seven_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  today date := public.club_today();
  now_local time := (now() at time zone 'America/Sao_Paulo')::time;
  n int := 0;
  r record;
begin
  for r in
    select up.member_id from public.user_preferences up
    join public.members m on m.id = up.member_id and m.status = 'active'
    where up.notify_seven_reminder and up.seven_reminder_time <= now_local
      and not exists (select 1 from public.check_ins c where c.member_id = up.member_id and c.day = today and c.completed_at is not null)
      and not exists (select 1 from public.notifications n where n.recipient_id = up.member_id and n.kind = 'seven_reminder'
                      and (n.created_at at time zone 'America/Sao_Paulo')::date = today)
  loop
    perform public.notify(r.member_id, null, 'seven_reminder', 'Seu SEVEN de hoje',
      'Um minuto para registrar o que você fez por você hoje.', '/seven');
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.queue_event_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  r record;
begin
  for r in
    select reg.event_id, reg.member_id, e.title, e.starts_at
    from public.event_registrations reg join public.events e on e.id = reg.event_id
    where reg.status <> 'cancelled' and reg.reminded_at is null and e.published
      and e.starts_at between now() and now() + interval '24 hours'
  loop
    perform public.notify(r.member_id, null, 'event_reminder', 'Seu evento é em breve',
      r.title || ' · ' || to_char(r.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"MI'),
      '/agenda/' || r.event_id, null, null, r.event_id);
    update public.event_registrations set reminded_at = now() where event_id = r.event_id and member_id = r.member_id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- dados pessoais (LGPD)
create or replace function public.my_export()
returns jsonb language sql stable security definer set search_path = '' as $$
  -- definer: inclui o que a própria integrante escreveu mesmo se ocultado pela moderação; tudo filtrado por auth.uid()
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'search_text' from public.profiles p where p.id = auth.uid()),
    'membership', coalesce((select jsonb_agg(to_jsonb(m)) from public.memberships m where m.member_id = auth.uid()), '[]'::jsonb),
    'preferences', (select to_jsonb(u) from public.user_preferences u where u.member_id = auth.uid()),
    'posts', coalesce((select jsonb_agg(to_jsonb(p) - 'search_text') from public.posts p where p.author_id = auth.uid()), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(c)) from public.comments c where c.author_id = auth.uid()), '[]'::jsonb),
    'check_ins', coalesce((select jsonb_agg(to_jsonb(c)) from public.check_ins c where c.member_id = auth.uid()), '[]'::jsonb),
    'own_activities', coalesce((select jsonb_agg(to_jsonb(a)) from public.daily_activities a where a.member_id = auth.uid()), '[]'::jsonb),
    'affirmation_favorites', coalesce((select jsonb_agg(to_jsonb(f)) from public.affirmation_favorites f where f.member_id = auth.uid()), '[]'::jsonb),
    'event_registrations', coalesce((select jsonb_agg(to_jsonb(r)) from public.event_registrations r where r.member_id = auth.uid()), '[]'::jsonb),
    'businesses', coalesce((select jsonb_agg(to_jsonb(b) - 'search_text') from public.businesses b where b.owner_id = auth.uid()), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(to_jsonb(p) - 'search_text') from public.projects p where p.owner_id = auth.uid()), '[]'::jsonb),
    'saved_posts', coalesce((select jsonb_agg(s.post_id) from public.saved_posts s where s.member_id = auth.uid()), '[]'::jsonb),
    'likes', coalesce((select jsonb_agg(l.post_id) from public.likes l where l.member_id = auth.uid()), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(b.blocked_id) from public.blocks b where b.blocker_id = auth.uid()), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------- administração
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := public.club_today();
begin
  if not public.is_staff('moderator') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  return jsonb_build_object(
    'members_active', (select count(*) from public.members where status = 'active'),
    'members_suspended', (select count(*) from public.members where status = 'suspended'),
    'members_new_30d', (select count(*) from public.members where created_at > now() - interval '30 days'),
    'invites_pending', (select count(*) from public.invitations where accepted_at is null and revoked_at is null and expires_at > now()),
    'active_7d', (select count(distinct x) from (
        select author_id x from public.posts where created_at > now() - interval '7 days'
        union all select author_id from public.comments where created_at > now() - interval '7 days'
        union all select member_id from public.likes where created_at > now() - interval '7 days'
        union all select member_id from public.check_ins where updated_at > now() - interval '7 days') a),
    'businesses', (select count(*) from public.businesses where hidden_at is null),
    'projects', (select count(*) from public.projects where hidden_at is null),
    'posts_7d', (select count(*) from public.posts where created_at > now() - interval '7 days'),
    'comments_7d', (select count(*) from public.comments where created_at > now() - interval '7 days'),
    'check_ins_7d', (select count(*) from public.check_ins where completed_at is not null and day > today - 7),
    'seven_shares_7d', (select count(*) from public.posts where source = 'seven' and created_at > now() - interval '7 days'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'events_upcoming', (select count(*) from public.events where starts_at > now() and published),
    'registrations_upcoming', (select count(*) from public.event_registrations r join public.events e on e.id = r.event_id
                               where e.starts_at > now() and r.status <> 'cancelled'),
    'affirmations_published', (select count(*) from public.affirmations where status = 'published'),
    'affirmations_left_in_cycle', (select count(*) from public.affirmations a where a.status = 'published'
        and not exists (select 1 from public.affirmation_schedule s where s.affirmation_id = a.id
                        and s.cycle = (select coalesce(max(cycle), 1) from public.affirmation_schedule))),
    'weeks', (select jsonb_agg(jsonb_build_object(
        'week_start', w::date,
        'posts', (select count(*) from public.posts p where p.created_at >= w and p.created_at < w + interval '7 days'),
        'members', (select count(*) from public.members m where m.created_at >= w and m.created_at < w + interval '7 days'),
        'check_ins', (select count(*) from public.check_ins c where c.completed_at is not null and c.day >= w::date and c.day < w::date + 7)
      ) order by w)
      from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') w),
    'pillars_30d', (select jsonb_agg(jsonb_build_object('name', pl.name, 'count', (
        select count(*) from public.check_ins c where c.pillar_id = pl.id and c.completed_at is not null and c.day > today - 30)) order by pl.position)
      from public.pillars pl)
  );
end $$;

create or replace function public.admin_members(p_q text default null, p_offset int default 0, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t text[] := public.search_terms(p_q);
begin
  if not public.is_staff('admin') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'role', m.role, 'status', m.status, 'created_at', m.created_at,
      'email', u.email, 'handle', p.handle, 'full_name', p.full_name, 'avatar_path', p.avatar_path,
      'membership', (select jsonb_build_object('id', ms.id, 'plan', ms.plan, 'status', ms.status, 'starts_at', ms.starts_at, 'ends_at', ms.ends_at)
                     from public.memberships ms where ms.member_id = m.id order by ms.created_at desc limit 1)
    ) order by p.full_name)
    from (
      select m.* from public.members m
      join public.profiles p on p.id = m.id
      join auth.users u on u.id = m.id
      where cardinality(t) = 0 or public.matches_all(p.search_text || ' ' || lower(u.email), t)
      order by p.full_name
      offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) m
    join public.profiles p on p.id = m.id
    join auth.users u on u.id = m.id), '[]'::jsonb);
end $$;

create or replace function public.admin_reports(p_status text default 'open')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff('moderator') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason, 'status', r.status,
      'created_at', r.created_at, 'resolution_note', r.resolution_note, 'reporter', public.member_card(r.reporter_id),
      'preview', case r.target_type
        when 'post' then (select jsonb_build_object('body', left(p.body, 280), 'hidden', p.hidden_at is not null,
                            'author', public.member_card(p.author_id), 'link', '/post/' || p.id) from public.posts p where p.id = r.target_id)
        when 'comment' then (select jsonb_build_object('body', c.body, 'hidden', c.hidden_at is not null,
                            'author', public.member_card(c.author_id), 'link', '/post/' || c.post_id) from public.comments c where c.id = r.target_id)
        when 'member' then (select jsonb_build_object('body', p.full_name || ' (@' || p.handle || ')', 'hidden', m.status = 'suspended',
                            'author', public.member_card(p.id), 'link', '/integrantes/' || p.handle)
                            from public.profiles p join public.members m on m.id = p.id where p.id = r.target_id)
        when 'business' then (select jsonb_build_object('body', b.name, 'hidden', b.hidden_at is not null,
                            'author', public.member_card(b.owner_id), 'link', '/business/' || b.slug) from public.businesses b where b.id = r.target_id)
        when 'project' then (select jsonb_build_object('body', pr.name, 'hidden', pr.hidden_at is not null,
                            'author', public.member_card(pr.owner_id), 'link', '/projetos/' || pr.slug) from public.projects pr where pr.id = r.target_id)
      end
    ) order by r.created_at desc)
    from public.reports r where p_status = 'all' or r.status::text = p_status), '[]'::jsonb);
end $$;

create or replace function public.admin_broadcast(p_title text, p_body text, p_link text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not public.is_staff('admin') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  insert into public.notifications (recipient_id, actor_id, kind, title, body, link)
  select m.id, auth.uid(), 'announcement', p_title, p_body, p_link
  from public.members m where m.status = 'active';
  get diagnostics n = row_count;
  insert into public.audit_log (actor_id, action, details) values (auth.uid(), 'broadcast', jsonb_build_object('title', p_title, 'recipients', n));
  return n;
end $$;

-- ---------------------------------------------------------------- permissões de execução
revoke execute on function public.queue_daily_affirmations() from public, anon, authenticated;
revoke execute on function public.queue_seven_reminders() from public, anon, authenticated;
revoke execute on function public.queue_event_reminders() from public, anon, authenticated;
revoke execute on function public.ensure_affirmation(date) from public, anon, authenticated;
revoke execute on function public.notify(uuid, uuid, public.notification_kind, text, text, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_mentions(text, uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.accept_invitation(text, text, text) from public, anon;
grant execute on function public.queue_daily_affirmations() to service_role;
grant execute on function public.queue_seven_reminders() to service_role;
grant execute on function public.queue_event_reminders() to service_role;
grant execute on function public.ensure_affirmation(date) to service_role;
grant execute on function public.invitation_lookup(text) to anon, authenticated;
grant execute on function public.handle_available(text) to anon, authenticated;
