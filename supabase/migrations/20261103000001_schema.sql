-- THE SEVEN CLUB · esquema base
-- Tabelas, tipos e índices. Regras de acesso (RLS) ficam em 0002; funções em 0003.

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Texto sem acento e em minúsculas, imutável (usado em colunas geradas de busca)
create or replace function public.f_norm(text)
returns text language sql immutable parallel safe strict
set search_path = ''
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, $1)) $$;

-- Data de hoje no fuso do clube
create or replace function public.club_today()
returns date language sql stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- ---------------------------------------------------------------- tipos
create type public.member_role as enum ('member', 'moderator', 'admin', 'super_admin');
create type public.member_status as enum ('active', 'suspended');
create type public.membership_status as enum ('trial', 'active', 'past_due', 'cancelled');
create type public.post_context as enum ('member', 'business', 'project');
create type public.post_source as enum ('manual', 'seven', 'affirmation');
create type public.project_visibility as enum ('club', 'private');
create type public.project_role as enum ('owner', 'collaborator');
create type public.business_role as enum ('owner', 'admin');
create type public.offering_kind as enum ('product', 'service');
create type public.affirmation_status as enum ('draft', 'published', 'archived');
create type public.event_kind as enum ('presencial', 'online', 'workshop', 'palestra', 'experiencia', 'atividade');
create type public.registration_status as enum ('registered', 'confirmed', 'cancelled');
create type public.report_status as enum ('open', 'actioned', 'dismissed');
create type public.report_target as enum ('post', 'comment', 'member', 'business', 'project');
create type public.notification_kind as enum (
  'like', 'comment', 'mention', 'project_invite', 'event', 'event_reminder',
  'affirmation', 'seven_reminder', 'announcement', 'moderation'
);

-- ---------------------------------------------------------------- integrantes
create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  status public.member_status not null default 'active',
  invited_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table public.profiles (
  id uuid primary key references public.members (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_.]{3,30}$'),
  full_name text not null check (char_length(full_name) between 2 and 80),
  headline text check (char_length(headline) <= 120),
  bio text check (char_length(bio) <= 600),
  city text check (char_length(city) <= 80),
  interests text[] not null default '{}',
  avatar_path text,
  instagram text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    public.f_norm(full_name || ' ' || handle || ' ' || coalesce(headline, '') || ' ' || coalesce(city, ''))
  ) stored
);
create index profiles_search_trgm on public.profiles using gin (search_text extensions.gin_trgm_ops);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  plan text not null default 'fundadora',
  status public.membership_status not null default 'active',
  starts_at date not null default public.club_today(),
  ends_at date,
  external_ref text,
  notes text,
  created_at timestamptz not null default now()
);
create index memberships_member on public.memberships (member_id, created_at desc);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  role public.member_role not null default 'member',
  plan text not null default 'fundadora',
  note text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references public.members (id) on delete set null
);
create index invitations_email on public.invitations (email);

create table public.user_preferences (
  member_id uuid primary key references public.members (id) on delete cascade,
  notify_likes boolean not null default true,
  notify_comments boolean not null default true,
  notify_mentions boolean not null default true,
  notify_projects boolean not null default true,
  notify_events boolean not null default true,
  notify_affirmation boolean not null default true,
  affirmation_time time not null default '08:00',
  notify_seven_reminder boolean not null default false,
  seven_reminder_time time not null default '20:00',
  push_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.members (id) on delete cascade,
  blocked_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ---------------------------------------------------------------- negócios
create table public.business_categories (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  icon text not null default 'store',
  sort smallint not null default 0
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 2 and 80),
  tagline text check (char_length(tagline) <= 120),
  description text check (char_length(description) <= 2000),
  category_id smallint not null references public.business_categories (id),
  owner_id uuid not null references public.members (id) on delete cascade,
  logo_path text,
  cover_path text,
  instagram text,
  website text,
  whatsapp text check (whatsapp ~ '^[0-9]{10,15}$'),
  city text,
  address text,
  service_area text,
  featured boolean not null default false,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    public.f_norm(name || ' ' || coalesce(tagline, '') || ' ' || coalesce(description, '') || ' ' || coalesce(city, '') || ' ' || coalesce(service_area, ''))
  ) stored
);
create index businesses_category on public.businesses (category_id, name);
create index businesses_owner on public.businesses (owner_id);
create index businesses_search_trgm on public.businesses using gin (search_text extensions.gin_trgm_ops);

create table public.business_admins (
  business_id uuid not null references public.businesses (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  role public.business_role not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (business_id, member_id)
);
create index business_admins_member on public.business_admins (member_id);

create table public.business_offerings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind public.offering_kind not null,
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 400),
  price_text text check (char_length(price_text) <= 40),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  search_text text generated always as (public.f_norm(name || ' ' || coalesce(description, ''))) stored
);
create index offerings_business on public.business_offerings (business_id, position);
create index offerings_search_trgm on public.business_offerings using gin (search_text extensions.gin_trgm_ops);

create table public.business_media (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  path text not null,
  width int,
  height int,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index business_media_business on public.business_media (business_id, position);

-- ---------------------------------------------------------------- projetos
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 2000),
  category text not null check (category in ('ideia', 'empreendimento', 'social', 'criativo', 'colaboracao', 'em-desenvolvimento')),
  visibility public.project_visibility not null default 'club',
  owner_id uuid not null references public.members (id) on delete cascade,
  cover_path text,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (public.f_norm(name || ' ' || coalesce(description, ''))) stored
);
create index projects_owner on public.projects (owner_id);
create index projects_search_trgm on public.projects using gin (search_text extensions.gin_trgm_ops);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  role public.project_role not null default 'collaborator',
  added_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, member_id)
);
create index project_members_member on public.project_members (member_id);

-- ---------------------------------------------------------------- SEVEN
create table public.pillars (
  id smallint primary key,
  slug text not null unique,
  name text not null,
  description text not null,
  prompt text not null,
  position smallint not null
);

-- Atividades sugeridas pelo clube (member_id nulo) ou criadas pela integrante
create table public.daily_activities (
  id uuid primary key default gen_random_uuid(),
  pillar_id smallint not null references public.pillars (id),
  member_id uuid references public.members (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index daily_activities_lookup on public.daily_activities (pillar_id, member_id);

-- Check-in privado: nunca exposto a outras integrantes nem à moderação
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  pillar_id smallint not null references public.pillars (id),
  activity_id uuid references public.daily_activities (id) on delete set null,
  day date not null default public.club_today(),
  completed_at timestamptz,
  note text check (char_length(note) <= 1000),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, pillar_id, day)
);
create index check_ins_member_day on public.check_ins (member_id, day desc);

-- ---------------------------------------------------------------- afirmações
create table public.affirmations (
  id uuid primary key default gen_random_uuid(),
  text text not null unique check (char_length(text) between 10 and 220),
  theme text not null check (theme in (
    'autoconfianca', 'amor-proprio', 'prosperidade', 'lideranca', 'disciplina', 'realizacao',
    'gratidao', 'coragem', 'abundancia', 'criatividade', 'proposito', 'independencia'
  )),
  status public.affirmation_status not null default 'draft',
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index affirmations_status on public.affirmations (status, theme);

create table public.affirmation_schedule (
  day date primary key,
  affirmation_id uuid not null references public.affirmations (id) on delete restrict,
  cycle int not null default 1,
  source text not null default 'auto' check (source in ('auto', 'manual')),
  created_at timestamptz not null default now()
);
create index affirmation_schedule_cycle on public.affirmation_schedule (cycle, affirmation_id);

create table public.affirmation_favorites (
  member_id uuid not null references public.members (id) on delete cascade,
  affirmation_id uuid not null references public.affirmations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, affirmation_id)
);

-- ---------------------------------------------------------------- feed
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.members (id) on delete cascade,
  context public.post_context not null default 'member',
  business_id uuid references public.businesses (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  source public.post_source not null default 'manual',
  pillar_id smallint references public.pillars (id),
  check_in_id uuid references public.check_ins (id) on delete set null,
  affirmation_id uuid references public.affirmations (id) on delete set null,
  body text not null default '' check (char_length(body) <= 3000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  hidden_at timestamptz,
  hidden_by uuid references public.members (id) on delete set null,
  search_text text generated always as (public.f_norm(body)) stored,
  constraint posts_context_target check (
    (context = 'member' and business_id is null and project_id is null) or
    (context = 'business' and business_id is not null and project_id is null) or
    (context = 'project' and project_id is not null and business_id is null)
  ),
  constraint posts_source_fields check (
    (source = 'manual' and pillar_id is null and affirmation_id is null) or
    (source = 'seven' and pillar_id is not null and context = 'member') or
    (source = 'affirmation' and affirmation_id is not null and context = 'member')
  )
);
create index posts_feed on public.posts (created_at desc, id desc);
create index posts_author on public.posts (author_id, created_at desc);
create index posts_business on public.posts (business_id, created_at desc) where business_id is not null;
create index posts_project on public.posts (project_id, created_at desc) where project_id is not null;
create index posts_source on public.posts (source, created_at desc);
create index posts_search_trgm on public.posts using gin (search_text extensions.gin_trgm_ops);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  path text not null,
  width int,
  height int,
  position smallint not null default 0
);
create index post_media_post on public.post_media (post_id, position);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.members (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  hidden_at timestamptz,
  hidden_by uuid references public.members (id) on delete set null
);
create index comments_post on public.comments (post_id, created_at);

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);
create index likes_member on public.likes (member_id);

create table public.saved_posts (
  post_id uuid not null references public.posts (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, post_id)
);

-- ---------------------------------------------------------------- agenda
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 4000),
  kind public.event_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  online_url text,
  cover_path text,
  capacity int check (capacity is null or capacity > 0),
  show_attendees boolean not null default true,
  published boolean not null default false,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (public.f_norm(title || ' ' || coalesce(description, '') || ' ' || coalesce(location, ''))) stored,
  check (ends_at is null or ends_at >= starts_at)
);
create index events_starts on public.events (starts_at);
create index events_search_trgm on public.events using gin (search_text extensions.gin_trgm_ops);

create table public.event_registrations (
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  status public.registration_status not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reminded_at timestamptz,
  primary key (event_id, member_id)
);
create index event_registrations_member on public.event_registrations (member_id);

-- ---------------------------------------------------------------- sistema
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.members (id) on delete cascade,
  actor_id uuid references public.members (id) on delete cascade,
  kind public.notification_kind not null,
  post_id uuid references public.posts (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  title text,
  body text,
  link text,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient on public.notifications (recipient_id, created_at desc);
create index notifications_unpushed on public.notifications (created_at) where pushed_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_member on public.push_subscriptions (member_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.members (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  status public.report_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.members (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status on public.reports (status, created_at desc);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  public_read boolean not null default false,
  updated_by uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.members (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_created on public.audit_log (created_at desc);

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger businesses_touch before update on public.businesses for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger check_ins_touch before update on public.check_ins for each row execute function public.touch_updated_at();
create trigger affirmations_touch before update on public.affirmations for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
create trigger event_registrations_touch before update on public.event_registrations for each row execute function public.touch_updated_at();
create trigger user_preferences_touch before update on public.user_preferences for each row execute function public.touch_updated_at();
