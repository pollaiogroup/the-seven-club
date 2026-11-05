-- THE SEVEN CLUB · projetos privados só para as participantes
-- Antes, moderação e administração liam projetos privados (e seus posts apareciam no feed delas).
-- Agora o conteúdo de um projeto privado fica só com as participantes. A equipe do clube:
--   - vê projetos do clube, inclusive os ocultos pela moderação;
--   - vê um projeto privado só quando ele é denunciado, pela prévia da denúncia (admin_reports);
--   - lista projetos privados apenas pelo nome (admin_projects);
--   - oculta ou reexibe conteúdo por moderate_content, sem precisar ler o projeto.

create or replace function public.can_view_project(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project
      and public.is_member()
      and (
        public.is_project_member(p.id)
        or (p.visibility = 'club' and (p.hidden_at is null or public.is_staff('moderator')))
      )
  )
$$;

drop policy projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    public.is_member()
    and (owner_id = auth.uid() or public.is_project_member(id)
         or (visibility = 'club' and (hidden_at is null or public.is_staff('moderator'))))
  );

-- Lista administrativa: projetos privados aparecem só com nome, categoria e responsável.
create or replace function public.admin_projects()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff('admin') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'slug', p.slug, 'name', p.name, 'category', p.category, 'visibility', p.visibility,
      'hidden_at', p.hidden_at, 'owner_name', pr.full_name,
      'members', (select count(*) from public.project_members pm where pm.project_id = p.id)
    ) order by p.created_at desc)
    from public.projects p left join public.profiles pr on pr.id = p.owner_id
  ), '[]'::jsonb);
end $$;
revoke execute on function public.admin_projects() from public, anon;
grant execute on function public.admin_projects() to authenticated;

-- Ocultar ou reexibir sem depender de poder ler o conteúdo (ex.: post denunciado dentro de projeto privado).
-- Empresas e integrantes continuam pelas rotas próprias (exigem papel de admin).
create or replace function public.moderate_content(p_type text, p_id uuid, p_hide boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  stamp timestamptz := case when p_hide then now() else null end;
  who uuid := case when p_hide then auth.uid() else null end;
  n int;
begin
  if not public.is_staff('moderator') then raise exception 'Sem permissão para moderar' using errcode = '42501'; end if;
  if p_type = 'post' then
    update public.posts set hidden_at = stamp, hidden_by = who where id = p_id;
  elsif p_type = 'comment' then
    update public.comments set hidden_at = stamp, hidden_by = who where id = p_id;
  elsif p_type = 'project' then
    update public.projects set hidden_at = stamp where id = p_id;
  else
    raise exception 'Tipo inválido' using errcode = '22023';
  end if;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke execute on function public.moderate_content(text, uuid, boolean) from public, anon;
grant execute on function public.moderate_content(text, uuid, boolean) to authenticated;
