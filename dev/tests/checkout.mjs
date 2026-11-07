// Fluxo completo da assinatura com um Asaas simulado: landing page → checkout → webhook → convite → conta → pagamentos.
// Rode o app com: ASAAS_API_KEY=chave-teste ASAAS_API_URL=http://127.0.0.1:4010/v3 ASAAS_CHECKOUT_URL=http://127.0.0.1:4010
//   ASAAS_WEBHOOK_TOKEN=token-de-teste-do-webhook-1234567890 ASSINATURA_VALOR=197 CHECKOUT_RETURN_ORIGINS=http://127.0.0.1:8099
// e depois: node dev/tests/checkout.mjs [landing.html] [pasta-de-fontes] [pasta-de-screenshots]
import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright-core';
import pg from 'pg';
const LP = process.argv[2] || 'landing/the-seven-club.html', FONTS = process.argv[3] || null, OUT = process.argv[4] || 'dev/.local/screens';
fs.mkdirSync(OUT, { recursive: true });
const B = 'http://localhost:3000', TOKEN = 'token-de-teste-do-webhook-1234567890';
const db = new pg.Pool({ connectionString: 'postgres://postgres@127.0.0.1:54322/postgres' });
const run = Date.now().toString(36), email = `assinante-${run}@teste.local`;
const calls = [];
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    if (req.url === '/v3/checkouts') { calls.push({ headers: req.headers, body: JSON.parse(body) }); res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ id: `chk_${run}` })); }
    if (req.url.startsWith('/checkoutSession/show')) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h1>Checkout Asaas (simulado)</h1>'); }
    res.writeHead(404); res.end();
  });
}).listen(4010);
// a landing page de verdade, apontando para o app local
http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(LP, 'utf8').replaceAll('https://the-seven-club.vercel.app', B)); }).listen(8099);
const hook = (event, extra) => fetch(`${B}/api/asaas/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': TOKEN }, body: JSON.stringify({ id: `evt_${event}_${run}`, event, ...extra }) });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const fontCss = (fam) => fam.includes('Playfair')
  ? `@font-face{font-family:'Playfair Display';font-style:normal;font-weight:400 900;src:url(http://fonts.local/pf.woff2)}@font-face{font-family:'Playfair Display';font-style:italic;font-weight:400 900;src:url(http://fonts.local/pfi.woff2)}@font-face{font-family:'DM Sans';font-weight:100 1000;src:url(http://fonts.local/dm.woff2)}` : '';
async function ctx(opts) {
  const c = await browser.newContext({ ...opts, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' });
  if (!FONTS) return c;
  await c.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: fontCss('Playfair') }));
  await c.route('http://fonts.local/**', (r) => r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(`${FONTS}/${r.request().url().split('/').pop()}`) }));
  return c;
}
const phone = await ctx(devices['iPhone 13']);
const p = await phone.newPage();
await p.goto('http://127.0.0.1:8099/the-seven-club.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/lp-celular.png`, fullPage: true });
// erro: e-mail que já é integrante volta para a landing page com aviso
const member = 'marina-duarte@demo.theseven.club';
await p.fill('input[name=nome]', 'Integrante Antiga'); await p.fill('input[name=email]', member);
await p.click('#go'); await p.waitForURL(/assinatura=erro/);
await p.getByText('já é de uma integrante').waitFor();
// compra
await p.fill('input[name=nome]', 'Carolina Assinante'); await p.fill('input[name=email]', email); await p.fill('input[name=whatsapp]', '(11) 98888-7777');
await p.click('#go'); await p.waitForURL(/checkoutSession\/show\?id=chk_/);
const call = calls.at(-1);
assert.equal(call.headers.access_token, 'chave-teste'); assert.equal(call.headers['user-agent'], 'the-seven-club');
assert.deepEqual(call.body.chargeTypes, ['RECURRENT']); assert.equal(call.body.subscription.cycle, 'MONTHLY'); assert.equal(call.body.items[0].value, 197);
const ref = call.body.externalReference;
assert.ok(call.body.callback.successUrl.endsWith(`/assinatura/obrigada?ref=${ref}`));
assert.equal(call.body.callback.cancelUrl, 'http://127.0.0.1:8099/the-seven-club.html');
// antes do webhook: aguardando
await p.goto(`${B}/assinatura/obrigada?ref=${ref}`); await p.getByText('Estamos confirmando o seu pagamento').waitFor();
await p.screenshot({ path: `${OUT}/obrigada-aguardando.png` });
// webhook sem token é recusado; com token cria o convite; repetido é ignorado
assert.equal((await fetch(`${B}/api/asaas/webhook`, { method: 'POST', body: '{}' })).status, 401);
assert.equal((await hook('CHECKOUT_PAID', { checkout: { id: `chk_${run}`, customer: 'cus_1' } })).status, 200);
assert.equal((await (await hook('CHECKOUT_PAID', { checkout: { id: `chk_${run}` } })).json()).duplicate, true);
await p.getByRole('link', { name: 'Criar minha conta' }).waitFor({ timeout: 15000 });
await p.screenshot({ path: `${OUT}/obrigada-confirmado.png` });
await p.getByRole('link', { name: 'Criar minha conta' }).click();
await p.fill('input[name=full_name]', 'Carolina Assinante'); await p.fill('input[name=handle]', `carol${run}`.slice(0, 30)); await p.fill('input[name=password]', 'senha-da-carol-123');
await p.check('input[name=terms]'); await p.click('button[type=submit]'); await p.waitForURL(/\/feed\?bemvinda=1/, { timeout: 20000 });
const m = async () => (await db.query(`select m.status, m.plan, m.ends_at::text, m.external_ref from public.memberships m join public.invitations i on i.accepted_by = m.member_id where i.email = $1`, [email])).rows[0];
let ms = await m(); console.log('após criar a conta', ms);
assert.equal(ms.plan, 'mensal'); assert.equal(ms.status, 'active'); assert.ok(ms.ends_at);
// assinatura e pagamentos seguintes
await hook('SUBSCRIPTION_CREATED', { subscription: { id: `sub_${run}`, customer: 'cus_1', checkoutSession: `chk_${run}` } });
await hook('PAYMENT_OVERDUE', { payment: { id: 'pay_2', subscription: `sub_${run}` } });
ms = await m(); assert.equal(ms.status, 'past_due'); assert.equal(ms.external_ref, `sub_${run}`);
await hook('PAYMENT_RECEIVED', { payment: { id: 'pay_3', subscription: `sub_${run}`, dueDate: '2026-12-06' } });
ms = await m(); console.log('após pagar dezembro', ms); assert.equal(ms.status, 'active'); assert.equal(ms.ends_at, '2027-01-11');
await hook('SUBSCRIPTION_DELETED', { subscription: { id: `sub_${run}` } });
assert.equal((await m()).status, 'cancelled');
// a landing page no computador
const desk = await ctx({ viewport: { width: 1440, height: 900 } });
const d = await desk.newPage(); await d.goto('http://127.0.0.1:8099/the-seven-club.html'); await d.evaluate(() => document.fonts.ready); await d.waitForTimeout(400);
await d.screenshot({ path: `${OUT}/lp-computador.png`, fullPage: true });
console.log('ok: fluxo de assinatura completo');
await browser.close(); await db.end(); process.exit(0);
