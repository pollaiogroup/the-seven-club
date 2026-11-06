-- THE SEVEN CLUB PLANNER
-- Agenda particular de cada integrante: linhas do dia (escritas à mão ou digitadas), com pilar e status,
-- e páginas livres (notas de cada pilar e fechamento da semana).
-- Privado: só a dona lê e grava. Nem moderação nem administração têm acesso, como nos check-ins.

create table public.planner_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  day date not null,
  position int not null default 0,
  text text not null default '' check (char_length(text) <= 300),
  -- traços da caneta: [{ c: cor, w: espessura, p: [x, y, pressão, ...] }], em unidades da altura da linha
  ink jsonb check (ink is null or (jsonb_typeof(ink) = 'array' and octet_length(ink::text) <= 200000)),
  pillar_id smallint references public.pillars (id),
  status text not null default 'open' check (status in ('open', 'done', 'cancelled', 'moved')),
  moved_to uuid references public.planner_items (id) on delete set null,
  moved_from uuid references public.planner_items (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planner_items_owner_day on public.planner_items (owner_id, day, position);
create trigger planner_items_touch before update on public.planner_items for each row execute function public.touch_updated_at();

create table public.planner_pages (
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  -- 'notas:body' … 'notas:lifestyle', 'semana:2026-11-30' (segunda-feira da semana)
  key text not null check (key ~ '^(notas:[a-z]+|semana:\d{4}-\d{2}-\d{2})$'),
  text text not null default '' check (char_length(text) <= 6000),
  ink jsonb check (ink is null or (jsonb_typeof(ink) = 'array' and octet_length(ink::text) <= 1500000)),
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);
create trigger planner_pages_touch before update on public.planner_pages for each row execute function public.touch_updated_at();

alter table public.planner_items enable row level security;
alter table public.planner_pages enable row level security;

create policy planner_items_own on public.planner_items for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_member());
create policy planner_pages_own on public.planner_pages for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_member());

grant select, insert, update, delete on public.planner_items, public.planner_pages to authenticated;

-- "Pular": leva a linha para o dia seguinte, com a escrita e o pilar, e marca a original como movida.
-- Chamar de novo na original desfaz (apaga a cópia, se ela ainda não foi mexida, e reabre).
create or replace function public.planner_jump(p_item uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  it public.planner_items;
  new_id uuid;
begin
  select * into it from public.planner_items where id = p_item and owner_id = auth.uid() for update;
  if not found then raise exception 'Linha não encontrada' using errcode = 'P0002'; end if;
  if it.status = 'moved' then
    delete from public.planner_items c where c.id = it.moved_to and c.status = 'open';
    update public.planner_items set status = 'open', moved_to = null where id = it.id;
    return null;
  end if;
  insert into public.planner_items (owner_id, day, position, text, ink, pillar_id, moved_from)
  values (auth.uid(), it.day + 1,
          coalesce((select max(position) + 1 from public.planner_items where owner_id = auth.uid() and day = it.day + 1), 0),
          it.text, it.ink, it.pillar_id, it.id)
  returning id into new_id;
  update public.planner_items set status = 'moved', moved_to = new_id where id = it.id;
  return new_id;
end $$;
grant execute on function public.planner_jump(uuid) to authenticated;

-- Exportação de dados (LGPD): inclui o planner
create or replace function public.my_export()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.my_export_base() || jsonb_build_object(
    'library', coalesce((select jsonb_agg(to_jsonb(l) || jsonb_build_object('book', public.book_json(b)))
                         from public.library_entries l join public.books b on b.id = l.book_id where l.member_id = auth.uid()), '[]'::jsonb),
    'book_clubs', coalesce((select jsonb_agg(jsonb_build_object('month', m.month, 'joined_at', r.created_at))
                            from public.book_readers r join public.book_months m on m.id = r.month_id where r.member_id = auth.uid()), '[]'::jsonb),
    'book_votes', coalesce((select jsonb_agg(jsonb_build_object('target_month', p.target_month, 'book_id', v.book_id))
                            from public.book_votes v join public.book_polls p on p.id = v.poll_id where v.member_id = auth.uid()), '[]'::jsonb),
    'planner', coalesce((select jsonb_agg(to_jsonb(i) order by i.day, i.position) from public.planner_items i where i.owner_id = auth.uid()), '[]'::jsonb),
    'planner_pages', coalesce((select jsonb_agg(to_jsonb(g)) from public.planner_pages g where g.owner_id = auth.uid()), '[]'::jsonb)
  )
$$;
grant execute on function public.my_export() to authenticated;
