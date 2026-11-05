-- THE SEVEN CLUB · segurança
-- Funções de apoio para RLS, políticas por tabela e gatilhos que protegem regras de negócio.

-- ---------------------------------------------------------------- funções de apoio
-- SECURITY DEFINER: leem tabelas sem recursão de RLS. Só respondem sobre o usuário atual.

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where id = auth.uid() and status = 'active')
$$;

create or replace function public.is_staff(min_role public.member_role default 'moderator')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and status = 'active' and role >= min_role
  )
$$;

create or replace function public.is_business_admin(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_admins ba
    join public.members m on m.id = ba.member_id and m.status = 'active'
    where ba.business_id = p_business and ba.member_id = auth.uid()
  )
$$;

create or replace function public.is_business_owner(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_admins
    where business_id = p_business and member_id = auth.uid() and role = 'owner'
  )
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project and member_id = auth.uid()
  )
$$;

create or replace function public.is_project_owner(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project and member_id = auth.uid() and role = 'owner'
  )
$$;

create or replace function public.can_view_project(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project
      and public.is_member()
      and (
        public.is_staff('moderator')
        or (p.hidden_at is null and p.visibility = 'club')
        or public.is_project_member(p.id)
      )
  )
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- ---------------------------------------------------------------- RLS ligada em tudo
alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.user_preferences enable row level security;
alter table public.blocks enable row level security;
alter table public.business_categories enable row level security;
alter table public.businesses enable row level security;
alter table public.business_admins enable row level security;
alter table public.business_offerings enable row level security;
alter table public.business_media enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.pillars enable row level security;
alter table public.daily_activities enable row level security;
alter table public.check_ins enable row level security;
alter table public.affirmations enable row level security;
alter table public.affirmation_schedule enable row level security;
alter table public.affirmation_favorites enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.saved_posts enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reports enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_log enable row level security;

-- Visitantes sem login não acessam nada além do que as funções públicas devolvem
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------- integrantes
create policy members_select on public.members for select to authenticated
  using (public.is_member() or id = auth.uid());
create policy members_admin_update on public.members for update to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

create policy profiles_select on public.profiles for select to authenticated
  using (public.is_member() or id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

create policy memberships_select on public.memberships for select to authenticated
  using (member_id = auth.uid() or public.is_staff('admin'));
create policy memberships_admin_all on public.memberships for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

create policy invitations_admin_all on public.invitations for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

create policy preferences_own on public.user_preferences for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid() and public.is_member());

-- ---------------------------------------------------------------- negócios
create policy categories_select on public.business_categories for select to authenticated
  using (public.is_member());
create policy categories_admin on public.business_categories for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

create policy businesses_select on public.businesses for select to authenticated
  using (public.is_member() and (hidden_at is null or public.is_business_admin(id) or public.is_staff('moderator')));
create policy businesses_insert on public.businesses for insert to authenticated
  with check (public.is_member() and owner_id = auth.uid() and featured = false and hidden_at is null);
create policy businesses_update on public.businesses for update to authenticated
  using (public.is_business_admin(id) or public.is_staff('admin'))
  with check (public.is_business_admin(id) or public.is_staff('admin'));
create policy businesses_delete on public.businesses for delete to authenticated
  using (public.is_business_owner(id) or public.is_staff('admin'));

create policy business_admins_select on public.business_admins for select to authenticated
  using (public.is_member());
create policy business_admins_insert on public.business_admins for insert to authenticated
  with check ((public.is_business_owner(business_id) or public.is_staff('admin')) and role = 'admin');
create policy business_admins_delete on public.business_admins for delete to authenticated
  using ((public.is_business_owner(business_id) or public.is_staff('admin') or member_id = auth.uid()) and role = 'admin');

create policy offerings_select on public.business_offerings for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id));
create policy offerings_write on public.business_offerings for all to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));

create policy business_media_select on public.business_media for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id));
create policy business_media_write on public.business_media for all to authenticated
  using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));

-- ---------------------------------------------------------------- projetos
-- Usa as colunas da própria linha (e não can_view_project) para que o INSERT ... RETURNING
-- de um projeto privado funcione: a função enxerga o snapshot anterior à inserção.
create policy projects_select on public.projects for select to authenticated
  using (
    public.is_member()
    and (owner_id = auth.uid() or public.is_staff('moderator')
         or (hidden_at is null and visibility = 'club') or public.is_project_member(id))
  );
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_member() and owner_id = auth.uid() and hidden_at is null);
create policy projects_update on public.projects for update to authenticated
  using (public.is_project_owner(id) or public.is_staff('admin'))
  with check (public.is_project_owner(id) or public.is_staff('admin'));
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_project_owner(id) or public.is_staff('admin'));

create policy project_members_select on public.project_members for select to authenticated
  using (public.can_view_project(project_id));
create policy project_members_insert on public.project_members for insert to authenticated
  with check (public.is_project_owner(project_id) and role = 'collaborator');
create policy project_members_delete on public.project_members for delete to authenticated
  using (role = 'collaborator' and (public.is_project_owner(project_id) or member_id = auth.uid()));

-- ---------------------------------------------------------------- SEVEN
create policy pillars_select on public.pillars for select to authenticated using (public.is_member());

create policy activities_select on public.daily_activities for select to authenticated
  using (public.is_member() and (member_id is null or member_id = auth.uid()));
create policy activities_own on public.daily_activities for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid() and public.is_member());
create policy activities_admin on public.daily_activities for all to authenticated
  using (member_id is null and public.is_staff('admin')) with check (member_id is null and public.is_staff('admin'));

-- Check-ins: só a dona. Nem moderação nem admin leem o conteúdo.
create policy check_ins_own on public.check_ins for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid() and public.is_member());

-- ---------------------------------------------------------------- afirmações
create policy affirmations_select on public.affirmations for select to authenticated
  using (public.is_member() and (status = 'published' or public.is_staff('admin')));
create policy affirmations_admin on public.affirmations for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

create policy schedule_select on public.affirmation_schedule for select to authenticated
  using (public.is_member() and (day <= public.club_today() or public.is_staff('admin')));
create policy schedule_admin on public.affirmation_schedule for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

create policy affirmation_favorites_own on public.affirmation_favorites for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid() and public.is_member());

-- ---------------------------------------------------------------- feed
create policy posts_select on public.posts for select to authenticated
  using (
    public.is_member()
    and (hidden_at is null or author_id = auth.uid() or public.is_staff('moderator'))
    and (project_id is null or public.can_view_project(project_id))
  );
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_member() and hidden_at is null);
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid() or public.is_staff('moderator'))
  with check (author_id = auth.uid() or public.is_staff('moderator'));
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_staff('moderator'));

create policy post_media_select on public.post_media for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_media_insert on public.post_media for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy post_media_delete on public.post_media for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create policy comments_select on public.comments for select to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id)
    and (hidden_at is null or author_id = auth.uid() or public.is_staff('moderator'))
  );
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = auth.uid() and public.is_member() and hidden_at is null
    and exists (select 1 from public.posts p where p.id = post_id and p.hidden_at is null)
  );
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid() or public.is_staff('moderator'))
  with check (author_id = auth.uid() or public.is_staff('moderator'));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_staff('moderator'));

create policy likes_select on public.likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy likes_own on public.likes for insert to authenticated
  with check (member_id = auth.uid() and public.is_member() and exists (select 1 from public.posts p where p.id = post_id));
create policy likes_delete_own on public.likes for delete to authenticated
  using (member_id = auth.uid());

create policy saved_own on public.saved_posts for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid() and public.is_member() and exists (select 1 from public.posts p where p.id = post_id));

-- ---------------------------------------------------------------- agenda
create policy events_select on public.events for select to authenticated
  using (public.is_member() and (published or public.is_staff('admin')));
create policy events_admin on public.events for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

create policy registrations_select on public.event_registrations for select to authenticated
  using (
    member_id = auth.uid()
    or public.is_staff('admin')
    or (public.is_member() and exists (select 1 from public.events e where e.id = event_id and e.show_attendees and e.published))
  );
create policy registrations_insert on public.event_registrations for insert to authenticated
  with check (member_id = auth.uid() and public.is_member() and exists (select 1 from public.events e where e.id = event_id and e.published));
create policy registrations_update on public.event_registrations for update to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy registrations_delete on public.event_registrations for delete to authenticated
  using (member_id = auth.uid());

-- ---------------------------------------------------------------- sistema
create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (recipient_id = auth.uid());

create policy push_own on public.push_subscriptions for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid() and public.is_member());

create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_member() and status = 'open');
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff('moderator'));
create policy reports_update on public.reports for update to authenticated
  using (public.is_staff('moderator')) with check (public.is_staff('moderator'));

grant select on public.app_settings to anon;
create policy settings_public_read on public.app_settings for select to anon, authenticated
  using (public_read or public.is_member());
create policy settings_admin on public.app_settings for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

create policy audit_admin_select on public.audit_log for select to authenticated
  using (public.is_staff('admin'));

-- ---------------------------------------------------------------- gatilhos de proteção

-- Posts: valida contexto e origem. Publicação SEVEN exige check-in concluído da própria autora.
create or replace function public.posts_validate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ci record;
begin
  if tg_op = 'UPDATE' then
    if not public.is_staff('moderator') or new.author_id = auth.uid() then
      -- autora só edita o texto
      if (new.author_id, new.context, new.business_id, new.project_id, new.source, new.pillar_id,
          new.check_in_id, new.affirmation_id, new.created_at)
         is distinct from
         (old.author_id, old.context, old.business_id, old.project_id, old.source, old.pillar_id,
          old.check_in_id, old.affirmation_id, old.created_at) then
        raise exception 'Somente o texto da publicação pode ser editado' using errcode = '42501';
      end if;
      if not public.is_staff('moderator') and new.hidden_at is distinct from old.hidden_at then
        raise exception 'Sem permissão para moderar' using errcode = '42501';
      end if;
      if new.body is distinct from old.body then
        new.edited_at := now();
      end if;
    else
      -- moderação só oculta ou reexibe
      if new.body is distinct from old.body then
        raise exception 'A moderação não altera o texto de integrantes' using errcode = '42501';
      end if;
      new.hidden_by := case when new.hidden_at is null then null else auth.uid() end;
    end if;
    return new;
  end if;

  if new.context = 'business' and not public.is_business_admin(new.business_id) then
    raise exception 'Só administradoras da empresa publicam no feed dela' using errcode = '42501';
  end if;
  if new.context = 'project' and not public.is_project_member(new.project_id) then
    raise exception 'Só participantes do projeto publicam no feed dele' using errcode = '42501';
  end if;

  if new.source = 'seven' then
    select * into ci from public.check_ins where id = new.check_in_id;
    if ci.id is null or ci.member_id <> new.author_id or ci.completed_at is null then
      raise exception 'Só atividades concluídas podem ser publicadas' using errcode = '23514';
    end if;
    new.pillar_id := ci.pillar_id;
  elsif new.check_in_id is not null then
    raise exception 'Check-in só pode ser ligado a publicações do SEVEN' using errcode = '23514';
  end if;

  if new.source = 'affirmation' and not exists (
    select 1 from public.affirmation_schedule s
    join public.affirmations a on a.id = s.affirmation_id and a.status = 'published'
    where s.affirmation_id = new.affirmation_id and s.day <= public.club_today()
  ) then
    raise exception 'Afirmação indisponível' using errcode = '23514';
  end if;

  new.hidden_at := null;
  new.hidden_by := null;
  new.edited_at := null;
  new.created_at := now();
  return new;
end $$;

create trigger posts_validate before insert or update on public.posts
  for each row execute function public.posts_validate();

-- Comentários: autora edita texto; moderação só oculta
create or replace function public.comments_validate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.post_id, new.author_id, new.created_at) is distinct from (old.post_id, old.author_id, old.created_at) then
    raise exception 'Alteração não permitida' using errcode = '42501';
  end if;
  if new.hidden_at is distinct from old.hidden_at then
    if not public.is_staff('moderator') then
      raise exception 'Sem permissão para moderar' using errcode = '42501';
    end if;
    new.hidden_by := case when new.hidden_at is null then null else auth.uid() end;
  end if;
  if new.body is distinct from old.body and new.author_id <> auth.uid() then
    raise exception 'A moderação não altera o texto de integrantes' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger comments_validate before update on public.comments
  for each row execute function public.comments_validate();

-- Empresas: só admin altera destaque/ocultação; dona vira owner em business_admins
create or replace function public.businesses_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if not public.is_staff('admin') then
      if new.featured is distinct from old.featured or new.hidden_at is distinct from old.hidden_at then
        raise exception 'Somente a administração do clube destaca ou oculta empresas' using errcode = '42501';
      end if;
      if new.owner_id is distinct from old.owner_id then
        raise exception 'A responsável pela empresa não pode ser trocada por aqui' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger businesses_guard before update on public.businesses
  for each row execute function public.businesses_guard();

create or replace function public.businesses_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.business_admins (business_id, member_id, role) values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end $$;

create trigger businesses_after_insert after insert on public.businesses
  for each row execute function public.businesses_after_insert();

-- Projetos: dona vira owner em project_members; dona não muda
create or replace function public.projects_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'A responsável pelo projeto não pode ser trocada por aqui' using errcode = '42501';
  end if;
  if new.hidden_at is distinct from old.hidden_at and not public.is_staff('moderator') then
    raise exception 'Sem permissão para moderar' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger projects_guard before update on public.projects
  for each row execute function public.projects_guard();

create or replace function public.projects_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_members (project_id, member_id, role, added_by)
  values (new.id, new.owner_id, 'owner', new.owner_id)
  on conflict do nothing;
  return new;
end $$;

create trigger projects_after_insert after insert on public.projects
  for each row execute function public.projects_after_insert();

-- Integrantes: só super admin promove a admin; ninguém altera o próprio papel; auditoria
create or replace function public.members_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.id = auth.uid() and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'Você não pode alterar o próprio papel ou status' using errcode = '42501';
  end if;
  if (new.role >= 'admin' or old.role >= 'admin') and new.role is distinct from old.role
     and not public.is_staff('super_admin') then
    raise exception 'Somente a super admin altera papéis de administração' using errcode = '42501';
  end if;
  if old.role = 'super_admin' and new.status is distinct from old.status and not public.is_staff('super_admin') then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'member.update', 'member', new.id::text,
          jsonb_build_object('role', jsonb_build_array(old.role, new.role), 'status', jsonb_build_array(old.status, new.status)));
  return new;
end $$;

create trigger members_guard before update on public.members
  for each row when (old.role is distinct from new.role or old.status is distinct from new.status)
  execute function public.members_guard();

-- Moderação registrada em auditoria
create or replace function public.audit_moderation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.hidden_at is distinct from old.hidden_at then
    insert into public.audit_log (actor_id, action, target_type, target_id, details)
    values (auth.uid(), case when new.hidden_at is null then 'unhide' else 'hide' end, tg_table_name, new.id::text, '{}');
  end if;
  return new;
end $$;

create trigger posts_audit after update on public.posts for each row execute function public.audit_moderation();
create trigger comments_audit after update on public.comments for each row execute function public.audit_moderation();
create trigger projects_audit after update on public.projects for each row execute function public.audit_moderation();
create trigger businesses_audit after update on public.businesses for each row execute function public.audit_moderation();

-- Inscrição em evento respeita capacidade
create or replace function public.registrations_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cap int;
  taken int;
begin
  if new.status = 'cancelled' then return new; end if;
  if tg_op = 'UPDATE' and old.status <> 'cancelled' then return new; end if;
  select capacity into cap from public.events where id = new.event_id for update;
  if cap is null then return new; end if;
  select count(*) into taken from public.event_registrations
  where event_id = new.event_id and status <> 'cancelled' and member_id <> new.member_id;
  if taken >= cap then
    raise exception 'Evento lotado' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger registrations_capacity before insert or update on public.event_registrations
  for each row execute function public.registrations_capacity();

-- Notificações: integrante só marca como lida
create or replace function public.notifications_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.recipient_id, new.kind, new.actor_id, new.post_id, new.title, new.body, new.link, new.created_at)
     is distinct from (old.recipient_id, old.kind, old.actor_id, old.post_id, old.title, old.body, old.link, old.created_at)
     and current_user = 'authenticated' then
    raise exception 'Somente a leitura pode ser marcada' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger notifications_guard before update on public.notifications
  for each row execute function public.notifications_guard();

-- Denúncias: moderação registra quem resolveu
create or replace function public.reports_resolve()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status <> 'open' then
    new.resolved_by := auth.uid();
    new.resolved_at := now();
  end if;
  return new;
end $$;

create trigger reports_resolve before update on public.reports
  for each row execute function public.reports_resolve();
