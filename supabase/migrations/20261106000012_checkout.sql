-- Assinatura pela landing page com o Asaas Checkout.
-- A landing page cria uma sessão (nome, e-mail, WhatsApp) e leva ao checkout do Asaas.
-- Quando o Asaas confirma o pagamento (webhook), o app cria o convite pessoal da integrante.
-- Os pagamentos seguintes mantêm a assinatura em dia, atrasada ou cancelada.
-- Só o servidor (chave de serviço) lê e grava estas tabelas: RLS ligado e nenhuma política.

create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 80),
  email text not null check (email = lower(email) and char_length(email) <= 160),
  phone text check (char_length(phone) <= 30),
  plan text not null default 'mensal',
  value numeric(10, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'canceled')),
  asaas_checkout_id text unique,
  asaas_customer_id text,
  asaas_subscription_id text unique,
  invitation_id uuid references public.invitations (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index checkout_sessions_email on public.checkout_sessions (email, created_at desc);

-- eventos do Asaas já processados (o Asaas pode reenviar o mesmo evento)
create table public.asaas_events (
  id text primary key,
  event text not null,
  received_at timestamptz not null default now()
);

alter table public.checkout_sessions enable row level security;
alter table public.asaas_events enable row level security;
revoke all on public.checkout_sessions, public.asaas_events from anon, authenticated;
grant all on public.checkout_sessions, public.asaas_events to service_role;

-- Quando a integrante aceita o convite de uma assinatura, a assinatura dela já nasce ligada ao Asaas e com vencimento.
create or replace function public.link_checkout_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare s public.checkout_sessions;
begin
  if new.accepted_at is null or old.accepted_at is not null or new.accepted_by is null then return new; end if;
  select * into s from public.checkout_sessions where invitation_id = new.id;
  if not found then return new; end if;
  update public.memberships
     set external_ref = coalesce(s.asaas_subscription_id, s.asaas_checkout_id),
         ends_at = (coalesce(s.paid_at, now()) at time zone 'America/Sao_Paulo')::date + interval '1 month' + interval '5 days',
         status = 'active'
   where member_id = new.accepted_by and plan = s.plan;
  return new;
end $$;
revoke execute on function public.link_checkout_membership() from public, anon, authenticated;
create trigger invitations_link_checkout after update of accepted_at on public.invitations
  for each row execute function public.link_checkout_membership();

-- A landing page não cria uma segunda assinatura para quem já é integrante (vale também para contas antigas, sem convite registrado).
create or replace function public.email_is_member(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u join public.members m on m.id = u.id where lower(u.email) = lower(p_email))
      or exists (select 1 from public.invitations i where i.email = lower(p_email) and i.accepted_at is not null)
$$;
revoke execute on function public.email_is_member(text) from public, anon, authenticated;
grant execute on function public.email_is_member(text) to service_role;
