import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/**
 * Asaas (pagamentos). Variáveis:
 * ASAAS_API_KEY       chave da API (Integrações > Chaves de API)
 * ASAAS_ENV           'sandbox' para testes; qualquer outro valor usa produção
 * ASAAS_WEBHOOK_TOKEN o "token de autenticação" cadastrado no webhook do Asaas
 * ASSINATURA_VALOR    valor mensal em reais, ex.: 197.00
 */
const sandbox = process.env.ASAAS_ENV === 'sandbox';
export const ASAAS_API = process.env.ASAAS_API_URL || (sandbox ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3');
const CHECKOUT_HOST = process.env.ASAAS_CHECKOUT_URL || (sandbox ? 'https://sandbox.asaas.com' : 'https://asaas.com');

export const assinaturaValor = () => {
  const v = Number(String(process.env.ASSINATURA_VALOR || '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
};

export async function asaas<T>(path: string, body?: unknown): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error('ASAAS_API_KEY não configurada');
  const res = await fetch(`${ASAAS_API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', access_token: key, 'User-Agent': 'the-seven-club' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { errors?: { description?: string }[] }).errors?.map((e) => e.description).join('; ') || res.statusText;
    throw new Error(`Asaas ${res.status}: ${msg}`);
  }
  return data as T;
}

export const checkoutLink = (c: { id: string; link?: string | null }) => c.link || `${CHECKOUT_HOST}/checkoutSession/show?id=${c.id}`;

/** Confere o token que o Asaas envia no cabeçalho asaas-access-token. */
export function validWebhookToken(received: string | null) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Data e hora de agora no fuso do clube, no formato que o Asaas espera (AAAA-MM-DD HH:mm:ss). */
export function asaasNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
