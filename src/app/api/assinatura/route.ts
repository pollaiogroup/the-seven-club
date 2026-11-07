import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/admin';
import { asaas, asaasNow, assinaturaValor, checkoutLink } from '@/lib/asaas';
import { SITE_URL } from '@/lib/env';

/**
 * Recebe o formulário da landing page (POST comum, sem JavaScript obrigatório), cria a sessão de assinatura
 * e leva a pessoa ao Asaas Checkout (assinatura mensal no cartão). O acesso só é liberado pelo webhook do Asaas.
 */
const schema = z.object({
  nome: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  whatsapp: z.string().trim().max(30).optional().transform((v) => (v ? v.replace(/[^\d+]/g, '') : null)),
});

// Endereços que podem receber a pessoa de volta (a landing page). Ex.: CHECKOUT_RETURN_ORIGINS=https://pollaio.com.br,https://www.pollaio.com.br
function returnUrl(raw: FormDataEntryValue | null) {
  const allowed = [SITE_URL, ...(process.env.CHECKOUT_RETURN_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)].map((u) => { try { return new URL(u).origin; } catch { return ''; } });
  const fallback = process.env.LANDING_URL || `${SITE_URL}/entrar`;
  try {
    const u = new URL(String(raw || ''));
    if (!allowed.includes(u.origin)) return fallback;
    u.hash = ''; u.searchParams.delete('assinatura'); u.searchParams.delete('motivo');
    return u.toString();
  } catch { return fallback; }
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const back = returnUrl(form.get('voltar'));
  const fail = (motivo: string) => NextResponse.redirect(`${back}${back.includes('?') ? '&' : '?'}assinatura=erro&motivo=${motivo}#assinar`, 303);

  if (form.get('website')) return fail('dados'); // campo invisível: só robôs preenchem
  const parsed = schema.safeParse({ nome: form.get('nome'), email: form.get('email'), whatsapp: form.get('whatsapp') || undefined });
  if (!parsed.success) return fail('dados');
  const valor = assinaturaValor();
  if (!valor || !process.env.ASAAS_API_KEY) return fail('indisponivel');

  const db = adminClient();
  const { email, nome, whatsapp } = parsed.data;
  const { data: already } = await db.rpc('email_is_member', { p_email: email });
  if (already) return fail('ja-integrante');
  // freio simples contra cliques repetidos: no máximo 5 tentativas por e-mail a cada hora
  const { count } = await db.from('checkout_sessions').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', new Date(Date.now() - 3600e3).toISOString());
  if ((count ?? 0) >= 5) return fail('tentativas');

  const { data: s, error } = await db.from('checkout_sessions').insert({ full_name: nome, email, phone: whatsapp, value: valor }).select('id').single();
  if (error || !s) return fail('indisponivel');
  try {
    const c = await asaas<{ id: string; link?: string }>('/checkouts', {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 120,
      externalReference: s.id,
      callback: { successUrl: `${SITE_URL}/assinatura/obrigada?ref=${s.id}`, cancelUrl: back, expiredUrl: back },
      items: [{ name: 'THE SEVEN CLUB', description: 'Assinatura mensal do clube', quantity: 1, value: valor }],
      subscription: { cycle: 'MONTHLY', nextDueDate: asaasNow() },
    });
    await db.from('checkout_sessions').update({ asaas_checkout_id: c.id }).eq('id', s.id);
    return NextResponse.redirect(checkoutLink(c), 303);
  } catch (e) {
    console.error('assinatura: checkout', e);
    await db.from('checkout_sessions').update({ status: 'canceled' }).eq('id', s.id);
    return fail('indisponivel');
  }
}
