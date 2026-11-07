import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient } from '@/lib/supabase/admin';
import { validWebhookToken } from '@/lib/asaas';

/**
 * Webhook do Asaas. No painel do Asaas (Integrações > Webhooks), aponte para /api/asaas/webhook,
 * com o mesmo token de ASAAS_WEBHOOK_TOKEN e os eventos de Checkout, Assinaturas e Cobranças.
 *
 * CHECKOUT_PAID ................ cria o convite pessoal (o botão aparece em /assinatura/obrigada)
 * SUBSCRIPTION_CREATED ......... liga a assinatura do Asaas à sessão
 * PAYMENT_CONFIRMED / RECEIVED . assinatura em dia (vencimento + 1 mês)
 * PAYMENT_OVERDUE .............. assinatura atrasada
 * SUBSCRIPTION_DELETED / INACTIVATED . assinatura cancelada
 */
type Session = { id: string; email: string; full_name: string; plan: string; status: string; invitation_id: string | null; asaas_subscription_id: string | null; asaas_checkout_id: string | null };
type Body = {
  id: string; event: string;
  checkout?: { id: string; customer?: string | null };
  subscription?: { id: string; customer?: string; checkoutSession?: string | null; externalReference?: string | null };
  payment?: { id: string; subscription?: string | null; externalReference?: string | null; checkoutSession?: string | null; dueDate?: string; customer?: string };
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS = 'id, email, full_name, plan, status, invitation_id, asaas_subscription_id, asaas_checkout_id';

async function findSession(db: SupabaseClient, by: { checkout?: string | null; subscription?: string | null; ref?: string | null }) {
  for (const [col, v] of [['asaas_checkout_id', by.checkout], ['asaas_subscription_id', by.subscription], ['id', by.ref && UUID.test(by.ref) ? by.ref : null]] as const) {
    if (!v) continue;
    const { data } = await db.from('checkout_sessions').select(COLS).eq(col, v).maybeSingle();
    if (data) return data as Session;
  }
  return null;
}

/** Pagamento confirmado: cria o convite (uma vez só) e marca a sessão como paga. */
async function markPaid(db: SupabaseClient, s: Session, customer?: string | null) {
  let invitation = s.invitation_id;
  if (!invitation) {
    const { data, error } = await db.from('invitations')
      .insert({ email: s.email, role: 'member', plan: s.plan, note: `Assinatura pelo site · ${s.full_name}`, expires_at: new Date(Date.now() + 30 * 86400e3).toISOString() })
      .select('id').single();
    if (error) throw error;
    invitation = data.id;
  }
  await db.from('checkout_sessions').update({ status: 'paid', paid_at: new Date().toISOString(), invitation_id: invitation, ...(customer ? { asaas_customer_id: customer } : {}) }).eq('id', s.id);
}

/** Atualiza a assinatura da integrante, se ela já criou a conta. */
async function setMembership(db: SupabaseClient, s: Session, patch: Record<string, unknown>) {
  if (!s.invitation_id) return;
  const { data: inv } = await db.from('invitations').select('accepted_by').eq('id', s.invitation_id).maybeSingle();
  if (!inv?.accepted_by) return;
  await db.from('memberships').update({ ...patch, external_ref: s.asaas_subscription_id || s.asaas_checkout_id }).eq('member_id', inv.accepted_by).eq('plan', s.plan);
}

const plusMonth = (d: string) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + 1); x.setUTCDate(x.getUTCDate() + 5); return x.toISOString().slice(0, 10); };

async function handle(db: SupabaseClient, b: Body) {
  switch (b.event) {
    case 'CHECKOUT_PAID': {
      const s = await findSession(db, { checkout: b.checkout?.id });
      if (s && s.status !== 'paid') await markPaid(db, s, b.checkout?.customer);
      return;
    }
    case 'CHECKOUT_EXPIRED':
    case 'CHECKOUT_CANCELED': {
      const s = await findSession(db, { checkout: b.checkout?.id });
      if (s && s.status === 'pending') await db.from('checkout_sessions').update({ status: b.event === 'CHECKOUT_EXPIRED' ? 'expired' : 'canceled' }).eq('id', s.id);
      return;
    }
    case 'SUBSCRIPTION_CREATED':
    case 'SUBSCRIPTION_UPDATED': {
      const sub = b.subscription; if (!sub) return;
      const s = await findSession(db, { checkout: sub.checkoutSession, subscription: sub.id, ref: sub.externalReference });
      if (s && !s.asaas_subscription_id) await db.from('checkout_sessions').update({ asaas_subscription_id: sub.id, asaas_customer_id: sub.customer ?? null }).eq('id', s.id);
      return;
    }
    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_INACTIVATED': {
      const s = await findSession(db, { subscription: b.subscription?.id, ref: b.subscription?.externalReference });
      if (s) await setMembership(db, s, { status: 'cancelled' });
      return;
    }
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_OVERDUE': {
      const p = b.payment; if (!p) return;
      let s = await findSession(db, { subscription: p.subscription, checkout: p.checkoutSession, ref: p.externalReference });
      if (!s) return;
      if (p.subscription && !s.asaas_subscription_id) { await db.from('checkout_sessions').update({ asaas_subscription_id: p.subscription }).eq('id', s.id); s = { ...s, asaas_subscription_id: p.subscription }; }
      if (b.event === 'PAYMENT_OVERDUE') { await setMembership(db, s, { status: 'past_due' }); return; }
      if (s.status !== 'paid') { await markPaid(db, s, p.customer); s = (await findSession(db, { ref: s.id }))!; }
      await setMembership(db, s, { status: 'active', ...(p.dueDate ? { ends_at: plusMonth(p.dueDate) } : {}) });
      return;
    }
  }
}

export async function POST(request: NextRequest) {
  if (!validWebhookToken(request.headers.get('asaas-access-token'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.id || !body.event) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const db = adminClient();
  const { error } = await db.from('asaas_events').insert({ id: body.id, event: body.event });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ error: 'db' }, { status: 500 });
  }
  try {
    await handle(db, body);
  } catch (e) {
    console.error('asaas webhook', body.event, e);
    await db.from('asaas_events').delete().eq('id', body.id); // permite o reenvio pelo Asaas
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
