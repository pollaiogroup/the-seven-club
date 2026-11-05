-- THE SEVEN CLUB · Clube do Livro e biblioteca pessoal
-- Ciclo do mês:
--   dia 1, 9h   notificação do livro do mês para todas
--   "Vou ler!"  a integrante entra no clube daquele mês e passa a receber os avisos do encontro
--   penúltima semana  votação entre 3 livros para o mês seguinte (placar só depois que fecha)
--   última semana     cupons de desconto para o livro vencedor
-- Biblioteca: cada integrante registra os livros que leu (do clube ou não), com estrelas de 1 a 7 e um comentário.
-- A estante aparece no perfil para todas; as estrelas ficam na biblioteca de cada uma, sem média do clube.

alter type public.notification_kind add value if not exists 'book_club';
alter table public.user_preferences add column if not exists notify_book_club boolean not null default true;

-- ---------------------------------------------------------------- livros
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  author text check (char_length(author) <= 120),
  cover_path text,
  club boolean not null default false,           -- cadastrado pela curadoria do clube
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  search_text text generated always as (public.f_norm(title || ' ' || coalesce(author, ''))) stored
);
create index books_club_idx on public.books (club, created_at desc);
create index books_search_idx on public.books using gin (search_text extensions.gin_trgm_ops);

-- livro de cada mês
create table public.book_months (
  id uuid primary key default gen_random_uuid(),
  month date not null unique check (extract(day from month) = 1),
  book_id uuid not null references public.books (id) on delete restrict,
  note text check (char_length(note) <= 1000),
  meeting_event_id uuid references public.events (id) on delete set null,
  announced_at timestamptz,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

-- quem disse "Vou ler esse livro!"
create table public.book_readers (
  month_id uuid not null references public.book_months (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  reminded_day_before_at timestamptz,
  reminded_day_of_at timestamptz,
  primary key (month_id, member_id)
);
create index book_readers_member_idx on public.book_readers (member_id);

-- votação do livro do mês seguinte
create table public.book_polls (
  id uuid primary key default gen_random_uuid(),
  target_month date not null unique check (extract(day from target_month) = 1),
  opens_on date not null,
  closes_on date not null,
  winner_book_id uuid references public.books (id) on delete set null,
  opened_notified_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  check (closes_on >= opens_on)
);
create table public.book_poll_options (
  poll_id uuid not null references public.book_polls (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete restrict,
  position smallint not null check (position between 1 and 3),
  primary key (poll_id, book_id),
  unique (poll_id, position)
);
create table public.book_votes (
  poll_id uuid not null references public.book_polls (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  book_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, member_id),
  foreign key (poll_id, book_id) references public.book_poll_options (poll_id, book_id) on delete cascade
);

-- cupons de desconto
create table public.book_coupons (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  store text not null check (char_length(store) between 2 and 80),
  code text not null check (char_length(code) between 2 and 40),
  url text check (url ~ '^https?://'),
  business_id uuid references public.businesses (id) on delete set null,
  details text check (char_length(details) <= 300),
  starts_on date not null default public.club_today(),
  valid_until date,
  notified_at timestamptz,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= starts_on)
);

-- biblioteca pessoal
create table public.library_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete restrict,
  rating smallint not null check (rating between 1 and 7),
  review text check (char_length(review) <= 2000),
  finished_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, book_id)
);
create index library_member_idx on public.library_entries (member_id, created_at desc);

-- ---------------------------------------------------------------- regras de acesso
alter table public.books enable row level security;
alter table public.book_months enable row level security;
alter table public.book_readers enable row level security;
alter table public.book_polls enable row level security;
alter table public.book_poll_options enable row level security;
alter table public.book_votes enable row level security;
alter table public.book_coupons enable row level security;
alter table public.library_entries enable row level security;

create policy books_select on public.books for select to authenticated using (public.is_member());
-- integrante cadastra livro para a própria biblioteca; livro do clube só a administração
create policy books_insert on public.books for insert to authenticated
  with check (public.is_member() and created_by = auth.uid() and (club = false or public.is_staff('admin')));
create policy books_update on public.books for update to authenticated
  using (public.is_staff('admin') or (created_by = auth.uid() and club = false))
  with check (public.is_staff('admin') or (created_by = auth.uid() and club = false));
create policy books_delete on public.books for delete to authenticated
  using (public.is_staff('admin') or (created_by = auth.uid() and club = false));

create policy book_months_select on public.book_months for select to authenticated
  using (public.is_member() and (month <= date_trunc('month', public.club_today())::date or public.is_staff('admin')));
create policy book_months_write on public.book_months for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- quem vai ler: o total é público; a lista nominal só a própria e a administração
create policy book_readers_select on public.book_readers for select to authenticated
  using (member_id = auth.uid() or public.is_staff('admin'));
create policy book_readers_insert on public.book_readers for insert to authenticated
  with check (public.is_member() and member_id = auth.uid()
              and exists (select 1 from public.book_months m where m.id = month_id and m.month <= date_trunc('month', public.club_today())::date));
create policy book_readers_delete on public.book_readers for delete to authenticated using (member_id = auth.uid());

create policy book_polls_select on public.book_polls for select to authenticated
  using (public.is_member() and (opens_on <= public.club_today() or public.is_staff('admin')));
create policy book_polls_write on public.book_polls for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));
create policy book_poll_options_select on public.book_poll_options for select to authenticated
  using (exists (select 1 from public.book_polls p where p.id = poll_id));
create policy book_poll_options_write on public.book_poll_options for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- voto: cada uma vê só o próprio; vota e troca o voto apenas com a votação aberta
create policy book_votes_select on public.book_votes for select to authenticated using (member_id = auth.uid());
create policy book_votes_insert on public.book_votes for insert to authenticated
  with check (public.is_member() and member_id = auth.uid()
              and exists (select 1 from public.book_polls p where p.id = poll_id and public.club_today() between p.opens_on and p.closes_on));
create policy book_votes_update on public.book_votes for update to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid()
              and exists (select 1 from public.book_polls p where p.id = poll_id and public.club_today() between p.opens_on and p.closes_on));

create policy book_coupons_select on public.book_coupons for select to authenticated
  using (public.is_member() and ((starts_on <= public.club_today() and (valid_until is null or valid_until >= public.club_today())) or public.is_staff('admin')));
create policy book_coupons_write on public.book_coupons for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- estante: todas as integrantes veem; cada uma escreve só a própria
create policy library_select on public.library_entries for select to authenticated using (public.is_member());
create policy library_insert on public.library_entries for insert to authenticated with check (public.is_member() and member_id = auth.uid());
create policy library_update on public.library_entries for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy library_delete on public.library_entries for delete to authenticated using (member_id = auth.uid());

grant select, insert, update, delete on public.books, public.book_months, public.book_readers, public.book_polls,
  public.book_poll_options, public.book_votes, public.book_coupons, public.library_entries to authenticated;

-- ---------------------------------------------------------------- funções
create or replace function public.book_json(b public.books)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', b.id, 'title', b.title, 'author', b.author, 'cover_path', b.cover_path)
$$;

-- Resultado da votação: só depois que ela fecha (ou para a administração)
create or replace function public.book_poll_results(p_poll uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p public.book_polls;
begin
  select * into p from public.book_polls where id = p_poll;
  if p.id is null or not public.is_member() then return null; end if;
  if public.club_today() <= p.closes_on and not public.is_staff('admin') then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('book_id', o.book_id, 'votes',
             (select count(*) from public.book_votes v where v.poll_id = o.poll_id and v.book_id = o.book_id)) order by o.position)
    from public.book_poll_options o where o.poll_id = p_poll), '[]'::jsonb);
end $$;
grant execute on function public.book_poll_results(uuid) to authenticated;

-- Tudo que a página do Clube do Livro precisa, em uma chamada
create or replace function public.book_club_home()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := public.club_today();
  cur public.book_months;
  poll public.book_polls;
  next_month date := (date_trunc('month', today) + interval '1 month')::date;
begin
  if not public.is_member() then return null; end if;
  select * into cur from public.book_months where month = date_trunc('month', today)::date;
  select * into poll from public.book_polls where target_month = next_month and opens_on <= today;
  return jsonb_build_object(
    'today', today,
    'current', case when cur.id is null then null else jsonb_build_object(
      'id', cur.id, 'month', cur.month, 'note', cur.note,
      'book', (select public.book_json(b) from public.books b where b.id = cur.book_id),
      'readers', (select count(*) from public.book_readers r where r.month_id = cur.id),
      'joined', exists (select 1 from public.book_readers r where r.month_id = cur.id and r.member_id = auth.uid()),
      'meeting', (select jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'kind', e.kind, 'location', e.location)
                  from public.events e where e.id = cur.meeting_event_id and e.published)
    ) end,
    'poll', case when poll.id is null then null else jsonb_build_object(
      'id', poll.id, 'target_month', poll.target_month, 'opens_on', poll.opens_on, 'closes_on', poll.closes_on,
      'status', case when today > poll.closes_on then 'closed' else 'open' end,
      'my_vote', (select v.book_id from public.book_votes v where v.poll_id = poll.id and v.member_id = auth.uid()),
      'winner_book_id', poll.winner_book_id,
      'options', (select jsonb_agg(public.book_json(b) order by o.position)
                  from public.book_poll_options o join public.books b on b.id = o.book_id where o.poll_id = poll.id),
      'results', case when today > poll.closes_on then public.book_poll_results(poll.id) end
    ) end,
    'coupons', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'store', c.store, 'code', c.code, 'url', c.url, 'details', c.details,
               'valid_until', c.valid_until, 'book', public.book_json(b),
               'business', (select jsonb_build_object('slug', bz.slug, 'name', bz.name) from public.businesses bz where bz.id = c.business_id and bz.hidden_at is null))
             order by c.created_at desc)
      from public.book_coupons c join public.books b on b.id = c.book_id
      where c.starts_on <= today and (c.valid_until is null or c.valid_until >= today)), '[]'::jsonb),
    'past', coalesce((
      select jsonb_agg(jsonb_build_object('month', m.month, 'book', public.book_json(b)) order by m.month desc)
      from (select * from public.book_months where month < date_trunc('month', today)::date order by month desc limit 24) m
      join public.books b on b.id = m.book_id), '[]'::jsonb)
  );
end $$;
grant execute on function public.book_club_home() to authenticated;

-- Estante de uma integrante (perfil)
create or replace function public.library_of(p_member uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'rating', l.rating, 'review', l.review, 'finished_on', l.finished_on, 'created_at', l.created_at,
    'book', public.book_json(b)) order by coalesce(l.finished_on, l.created_at::date) desc, l.created_at desc), '[]'::jsonb)
  from public.library_entries l join public.books b on b.id = l.book_id
  where l.member_id = p_member
$$;
grant execute on function public.library_of(uuid) to authenticated;

-- Avisos do encontro para quem vai ler: marcar ou mudar a data reinicia os lembretes
create or replace function public.book_meeting_changed(p_month uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.book_months; e public.events; b public.books; r record;
begin
  select * into m from public.book_months where id = p_month;
  select * into e from public.events where id = m.meeting_event_id;
  if e.id is null or not e.published or e.starts_at < now() then return; end if;
  select * into b from public.books where id = m.book_id;
  update public.book_readers set reminded_day_before_at = null, reminded_day_of_at = null where month_id = m.id;
  for r in select member_id from public.book_readers where month_id = m.id loop
    perform public.notify(r.member_id, null, 'book_club', 'Encontro do Clube do Livro',
      b.title || ' · ' || to_char(e.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"MI'), '/agenda/' || e.id, null, null, e.id);
  end loop;
end $$;
revoke execute on function public.book_meeting_changed(uuid) from public, anon, authenticated;

create or replace function public.book_months_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.meeting_event_id is not null and (tg_op = 'INSERT' or new.meeting_event_id is distinct from old.meeting_event_id) then
    perform public.book_meeting_changed(new.id);
  end if;
  return new;
end $$;
create trigger book_months_after_write after insert or update of meeting_event_id on public.book_months
  for each row execute function public.book_months_after_write();

create or replace function public.events_book_meeting_moved()
returns trigger language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  if new.starts_at is distinct from old.starts_at or (new.published and not old.published) then
    for m in select id from public.book_months where meeting_event_id = new.id loop
      perform public.book_meeting_changed(m.id);
    end loop;
  end if;
  return new;
end $$;
create trigger events_book_meeting_moved after update of starts_at, published on public.events
  for each row execute function public.events_book_meeting_moved();

-- Rotina do Clube do Livro (chamada pelo /api/cron/dispatch). p_now só existe para os testes simularem o relógio.
create or replace function public.queue_book_club(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = '' as $$
declare
  today date := (p_now at time zone 'America/Sao_Paulo')::date;
  morning boolean := (p_now at time zone 'America/Sao_Paulo')::time >= time '09:00';
  n int := 0;
  r record; x record; b public.books; top int; winners uuid[];
  meses text[] := array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
begin
  -- 1. livro do mês, a partir das 9h do dia 1 (ou no primeiro horário depois, se a rotina atrasar)
  if morning then
    for r in select m.*, bk.title, bk.author from public.book_months m join public.books bk on bk.id = m.book_id
             where m.month = date_trunc('month', today)::date and m.announced_at is null loop
      for x in select id from public.members where status = 'active' loop
        perform public.notify(x.id, null, 'book_club', 'Livro de ' || meses[extract(month from r.month)::int],
          r.title || coalesce(', de ' || r.author, ''), '/clube-do-livro');
        n := n + 1;
      end loop;
      update public.book_months set announced_at = now() where id = r.id;
    end loop;

    -- 2. votação aberta
    for r in select * from public.book_polls where opens_on <= today and closes_on >= today and opened_notified_at is null loop
      for x in select id from public.members where status = 'active' loop
        perform public.notify(x.id, null, 'book_club', 'Vote no livro de ' || meses[extract(month from r.target_month)::int],
          'Três opções escolhidas pela curadoria. A votação vai até ' || to_char(r.closes_on, 'DD/MM') || '.', '/clube-do-livro');
        n := n + 1;
      end loop;
      update public.book_polls set opened_notified_at = now() where id = r.id;
    end loop;

    -- 4. cupons
    for r in select c.*, bk.title from public.book_coupons c join public.books bk on bk.id = c.book_id
             where c.starts_on <= today and (c.valid_until is null or c.valid_until >= today) and c.notified_at is null loop
      for x in select id from public.members where status = 'active' loop
        perform public.notify(x.id, null, 'book_club', 'Cupom para ' || r.title, r.store || ' · use o código ' || r.code, '/clube-do-livro');
        n := n + 1;
      end loop;
      update public.book_coupons set notified_at = now() where id = r.id;
    end loop;
  end if;

  -- 3. votação encerrada: o mais votado vira o livro do mês seguinte; empate fica para a administração
  for r in select * from public.book_polls where closes_on < today and closed_at is null loop
    select max(c) into top from (select count(*) c from public.book_votes v where v.poll_id = r.id group by v.book_id) t;
    select array_agg(book_id) into winners from (
      select v.book_id from public.book_votes v where v.poll_id = r.id group by v.book_id having count(*) = top) t;
    if top is not null and array_length(winners, 1) = 1 then
      update public.book_polls set winner_book_id = winners[1], closed_at = now() where id = r.id;
      insert into public.book_months (month, book_id, created_by) values (r.target_month, winners[1], r.created_by)
        on conflict (month) do nothing;
      select * into b from public.books where id = winners[1];
      for x in select id from public.members where status = 'active' loop
        perform public.notify(x.id, null, 'book_club', 'Resultado da votação',
          b.title || ' é o livro de ' || meses[extract(month from r.target_month)::int] || '.', '/clube-do-livro');
        n := n + 1;
      end loop;
    else
      update public.book_polls set closed_at = now() where id = r.id;
      for x in select id from public.members where status = 'active' and role in ('admin', 'super_admin') loop
        perform public.notify(x.id, null, 'book_club', 'Votação do livro empatada',
          case when top is null then 'Ninguém votou. Escolha o livro do mês no painel.' else 'Escolha o livro do mês no painel.' end,
          '/admin/clube-do-livro');
        n := n + 1;
      end loop;
    end if;
  end loop;

  -- 5. lembretes do encontro: na véspera e no dia
  for r in select br.month_id, br.member_id, br.reminded_day_before_at, br.reminded_day_of_at, e.id event_id, e.starts_at, bk.title
           from public.book_readers br
           join public.book_months m on m.id = br.month_id
           join public.events e on e.id = m.meeting_event_id and e.published
           join public.books bk on bk.id = m.book_id
           where e.starts_at > p_now and e.starts_at <= p_now + interval '36 hours' loop
    if (r.starts_at at time zone 'America/Sao_Paulo')::date = today and morning and r.reminded_day_of_at is null then
      perform public.notify(r.member_id, null, 'book_club', 'Hoje tem encontro do Clube do Livro',
        r.title || ' · às ' || to_char(r.starts_at at time zone 'America/Sao_Paulo', 'HH24"h"MI'), '/agenda/' || r.event_id, null, null, r.event_id);
      update public.book_readers set reminded_day_of_at = now(), reminded_day_before_at = coalesce(reminded_day_before_at, now())
        where month_id = r.month_id and member_id = r.member_id;
      n := n + 1;
    elsif (r.starts_at at time zone 'America/Sao_Paulo')::date = today + 1 and r.reminded_day_before_at is null then
      perform public.notify(r.member_id, null, 'book_club', 'Amanhã tem encontro do Clube do Livro',
        r.title || ' · ' || to_char(r.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"MI'), '/agenda/' || r.event_id, null, null, r.event_id);
      update public.book_readers set reminded_day_before_at = now() where month_id = r.month_id and member_id = r.member_id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.queue_book_club(timestamptz) from public, anon, authenticated;
grant execute on function public.queue_book_club(timestamptz) to service_role;

-- Preferência: quem desligou o Clube do Livro não recebe esses avisos
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
       or (p_kind = 'seven_reminder' and not pref.notify_seven_reminder)
       or (p_kind::text = 'book_club' and not pref.notify_book_club) then
      return;
    end if;
  end if;
  insert into public.notifications (recipient_id, actor_id, kind, title, body, link, post_id, project_id, event_id)
  values (p_recipient, p_actor, p_kind, p_title, p_body, p_link, p_post, p_project, p_event);
end $$;

-- Exportação de dados (LGPD) passa a incluir biblioteca, clubes e votos
alter function public.my_export() rename to my_export_base;
revoke execute on function public.my_export_base() from public, anon, authenticated;
create or replace function public.my_export()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.my_export_base() || jsonb_build_object(
    'library', coalesce((select jsonb_agg(to_jsonb(l) || jsonb_build_object('book', public.book_json(b)))
                         from public.library_entries l join public.books b on b.id = l.book_id where l.member_id = auth.uid()), '[]'::jsonb),
    'book_clubs', coalesce((select jsonb_agg(jsonb_build_object('month', m.month, 'joined_at', r.created_at))
                            from public.book_readers r join public.book_months m on m.id = r.month_id where r.member_id = auth.uid()), '[]'::jsonb),
    'book_votes', coalesce((select jsonb_agg(jsonb_build_object('target_month', p.target_month, 'book_id', v.book_id))
                            from public.book_votes v join public.book_polls p on p.id = v.poll_id where v.member_id = auth.uid()), '[]'::jsonb)
  )
$$;
grant execute on function public.my_export() to authenticated;

-- Atividade do pilar MIND para a leitura do clube
insert into public.daily_activities (pillar_id, title)
select id, 'Livro do clube' from public.pillars where slug = 'mind'
  and not exists (select 1 from public.daily_activities a join public.pillars p on p.id = a.pillar_id
                  where p.slug = 'mind' and a.member_id is null and a.title = 'Livro do clube');
