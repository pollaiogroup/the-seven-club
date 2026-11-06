// Teste de ponta a ponta no celular (iPhone simulado) contra o app real e o ambiente local.
// Pré-requisitos: dev/local-supabase/start.sh --reset, `npm run build && npm start` em :3000.
// Uso: npm run test:e2e   (screenshots em dev/.local/screens)

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const shots = path.resolve('dev/.local/screens');
fs.mkdirSync(shots, { recursive: true });
// E2E_DATABASE_URL aponta para o Postgres do ambiente local (emulador ou pilha Supabase real)
const db = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:54329/seven' });
const q = (s, p) => db.query(s, p).then((r) => r.rows);

const run = Date.now().toString(36).slice(-4);
const POST = `Primeira publicação do clube ${run}`;
const SHARE = `Terminei um livro incrível ${run}`;
const EVENT = `Café das Fundadoras ${run}`;
const admin = { email: `fundadora-${run}@teste.local`, name: 'Fundadora Teste', handle: `fundadora_${run}`, pass: 'senha-forte-123' };
const ana = { email: `ana-${run}@teste.local`, name: 'Ana Teste', handle: `ana_${run}`, pass: 'senha-forte-456' };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const device = {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};
const errors = [];
let step = 0;
const results = [];

async function newPage() {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  const goto = page.goto.bind(page);
  page.goto = (u, o) => goto(u, { waitUntil: 'networkidle', ...o }); // espera a hidratação antes de interagir
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(404|401)/.test(m.text())) errors.push(`console: ${m.text()}`); });
  return page;
}
async function shot(page, name, full = false) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(shots, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: full });
}
async function check(name, fn) {
  try { await fn(); results.push(`  ok  ${name}`); }
  catch (e) {
    results.push(`  FALHOU  ${name}\n        ${e.message.split('\n')[0]}`); process.exitCode = 1;
    // foto de cada aba aberta no momento da falha
    for (const [i, pg] of browser.contexts().flatMap((c) => c.pages()).entries()) await pg.screenshot({ path: path.join(shots, `falha-${String(step).padStart(2, '0')}-${i}.png`) }).catch(() => {});
  }
}
const toast = (page) => page.locator('[aria-live="polite"] div').last();

// imagem de teste
const img = path.join(shots, 'fixture.jpg');
if (!fs.existsSync(img)) {
  const { execSync } = await import('node:child_process');
  execSync(`python3 -c "from PIL import Image, ImageDraw; im=Image.new('RGB',(1600,1200),(201,175,168)); d=ImageDraw.Draw(im); d.ellipse((500,300,1100,900), fill=(69,11,24)); im.save('${img}', quality=90)"`);
}

// convite da fundadora (como no README: primeiro convite criado direto no banco)
const [{ token: adminToken }] = await q(`insert into public.invitations (email, role, plan) values ($1, 'super_admin', 'fundadora') returning token`, [admin.email]);

const A = await newPage();

await check('rota protegida leva para a entrada', async () => {
  await A.goto(`${BASE}/feed`);
  await A.waitForURL(/\/entrar/);
  await shot(A, 'entrar');
});

await check('convite cria a conta e entra no clube', async () => {
  await A.goto(`${BASE}/convite/${adminToken}`);
  await shot(A, 'convite');
  await A.fill('input[name=full_name]', admin.name);
  await A.fill('input[name=handle]', admin.handle);
  await A.fill('input[name=password]', admin.pass);
  await A.check('input[name=terms]');
  await A.click('button[type=submit]');
  await A.waitForURL(/\/feed\?bemvinda=1/, { timeout: 20000 });
  await A.getByText('Afirmação do dia').first().waitFor();
  await shot(A, 'feed-vazio');
});

await check('convite usado não pode ser reaproveitado', async () => {
  const p = await newPage();
  await p.goto(`${BASE}/convite/${adminToken}`);
  await p.getByText('Convite indisponível').waitFor();
  await p.context().close();
});

await check('publicação com texto, menção e imagem é salva e aparece no feed', async () => {
  await A.goto(`${BASE}/publicar`);
  await A.fill('textarea[name=body]', `${POST}! Bem-vindas 🌟`);
  await A.setInputFiles('input[type=file]', img);
  await A.locator('img[src*="/storage/v1/object/public/media/"]').first().waitFor({ timeout: 20000 });
  await shot(A, 'publicar');
  await A.click('button:has-text("Publicar")');
  await A.waitForURL(/\/feed$/);
  await A.getByText(POST).waitFor();
  const rows = await q(`select p.id, count(m.*)::int n from public.posts p left join public.post_media m on m.post_id = p.id where p.body like $1 group by p.id`, [`${POST}%`]);
  assert.equal(rows[0].n, 1, 'imagem anexada no banco');
  await shot(A, 'feed-com-post');
});

await check('SEVEN: toque rápido conclui o pilar sem publicar', async () => {
  await A.goto(`${BASE}/seven`);
  await A.getByText('0 / 7').waitFor();
  await A.getByRole('button', { name: 'Marcar BODY como concluído' }).click();
  await A.getByText('1 / 7').waitFor({ timeout: 10000 });
  const posts = await q(`select count(*)::int n from public.posts p join auth.users u on u.id = p.author_id where p.source = 'seven' and u.email = $1`, [admin.email]);
  assert.equal(posts[0].n, 0, 'concluir não publica');
  await shot(A, 'seven');
});

await check('SEVEN: registro com nota privada e publicação voluntária sem a nota', async () => {
  await A.goto(`${BASE}/seven/mind`);
  await A.getByRole('button', { name: 'Leitura' }).click();
  await A.fill('textarea[name=note]', 'NOTA-PRIVADA-SECRETA sobre o livro');
  await A.click('button:has-text("Salvar registro")');
  await A.getByText(/Concluída|salvo/).first().waitFor();
  await A.reload({ waitUntil: 'networkidle' });
  await A.getByText('Compartilhar no Feed').first().waitFor();
  await shot(A, 'seven-pilar', true);
  await A.fill('form:has(button:has-text("Compartilhar no Feed")) textarea[name=body]', `${SHARE}.`);
  await A.click('button:has-text("Compartilhar no Feed")');
  await A.getByText(/Compartilhad[oa] no Feed\./).first().waitFor();
  await A.goto(`${BASE}/feed?escopo=seven`);
  await A.getByText(`${SHARE}.`).waitFor();
  const html = await A.content();
  assert.ok(!html.includes('NOTA-PRIVADA-SECRETA'), 'nota privada não aparece no feed');
});

await check('afirmação do dia: favoritar persiste', async () => {
  await A.goto(`${BASE}/afirmacoes`);
  await A.getByRole('button', { name: 'Favoritar' }).first().click();
  await A.waitForTimeout(800);
  await A.goto(`${BASE}/afirmacoes?aba=favoritas`);
  await A.locator('li blockquote, li p.font-display').first().waitFor();
  const favs = await q(`select count(*)::int n from public.affirmation_favorites f join auth.users u on u.id = f.member_id where u.email = $1`, [admin.email]);
  assert.equal(favs[0].n, 1);
  await A.goto(`${BASE}/afirmacoes`);
  await shot(A, 'afirmacao', true);
});

let businessSlug;
await check('empresa: cadastro, item e busca pelo serviço', async () => {
  await A.goto(`${BASE}/business/nova`);
  await A.fill('input[name=name]', 'Ateliê Aurora');
  await A.fill('input[name=tagline]', 'Estúdio de design e branding');
  await A.selectOption('select[name=category_id]', { label: 'Negócios' });
  await A.fill('textarea[name=description]', 'Identidades visuais para marcas femininas.');
  await A.fill('input[name=whatsapp]', '11 98888-7777');
  await A.fill('input[name=instagram]', '@atelieaurora');
  await A.click('button:has-text("Cadastrar empresa")');
  await A.waitForURL(/\/business\/[a-z0-9-]+\?nova=1/);
  businessSlug = new URL(A.url()).pathname.split('/').pop();
  await A.goto(`${BASE}/business/${businessSlug}/editar`);
  await A.fill('form:has(button:has-text("Adicionar")) input[name=name]', 'Mentoria de marca pessoal');
  await A.fill('input[name=price_text]', 'a partir de R$ 450');
  await A.click('button:has-text("Adicionar")');
  await A.getByText('Item adicionado.').waitFor();
  await A.goto(`${BASE}/business?q=mentoria`);
  await A.getByText('Ateliê Aurora').first().waitFor();
  await A.goto(`${BASE}/business/${businessSlug}`);
  await shot(A, 'empresa');
  await A.goto(`${BASE}/business`);
  await shot(A, 'business');
});

let projectSlug;
await check('projeto privado criado pela integrante', async () => {
  await A.goto(`${BASE}/projetos/novo`);
  await A.fill('input[name=name]', 'Projeto Confidencial');
  await A.selectOption('select[name=category]', 'ideia');
  await A.check('input[name=visibility][value=private]');
  await A.click('button:has-text("Criar projeto")');
  await A.waitForURL(/\/projetos\/projeto-confidencial/);
  projectSlug = new URL(A.url()).pathname.split('/').pop();
  await A.getByText('Projeto privado').waitFor();
});

let anaToken;
await check('admin: cria convite, evento publicado e link da Grioh', async () => {
  await A.goto(`${BASE}/admin`);
  await A.getByText('Integrantes ativas').waitFor();
  await shot(A, 'admin-indicadores', true);
  await A.goto(`${BASE}/admin/convites`);
  await A.fill('input[name=email]', ana.email);
  await A.click('button:has-text("Criar convite")');
  await A.getByText('Convite criado').waitFor();
  [{ token: anaToken }] = await q(`select token from public.invitations where email = $1`, [ana.email]);
  await A.goto(`${BASE}/admin/eventos`);
  await A.fill('input[name=title]', EVENT);
  await A.selectOption('select[name=kind]', 'presencial');
  const d = new Date(Date.now() + 3 * 86400000);
  const local = new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10) + 'T09:00';
  await A.fill('input[name=starts_at]', local);
  await A.fill('input[name=location]', 'Rua Oscar Freire, 100, São Paulo');
  await A.fill('input[name=capacity]', '20');
  await A.check('input[name=published]');
  await A.click('button:has-text("Criar evento")');
  await A.getByText('Evento criado.').waitFor();
  await A.goto(`${BASE}/admin/conteudo`);
  await A.fill('form:has(input[name=value][inputmode=url]) input[name=value]', 'https://comunidade.grioh.com.br/seven');
  await A.locator('form:has(input[name=value][inputmode=url]) button').click();
  await A.getByText('Conteúdo salvo.').first().waitFor();
});

const B = await newPage();
await check('segunda integrante entra por convite e vê o feed', async () => {
  await B.goto(`${BASE}/convite/${anaToken}`);
  await B.fill('input[name=full_name]', ana.name);
  await B.fill('input[name=handle]', ana.handle);
  await B.fill('input[name=password]', ana.pass);
  await B.check('input[name=terms]');
  await B.click('button[type=submit]');
  await B.waitForURL(/\/feed/, { timeout: 20000 });
  await B.getByText(POST).waitFor();
});

await check('segunda integrante não vê projeto privado nem check-ins da outra', async () => {
  await B.goto(`${BASE}/projetos/${projectSlug}`);
  await B.getByText('Página não encontrada').waitFor();
  assert.equal(await B.getByText('Projeto Confidencial').count(), 0);
  await B.goto(`${BASE}/seven`);
  await B.getByText('0 / 7').waitFor();
});

await check('curtida, comentário e notificação para a autora', async () => {
  await B.goto(`${BASE}/feed?escopo=members`);
  const card = B.locator('article', { hasText: POST });
  await card.getByRole('button', { name: 'Curtir' }).click();
  await card.getByRole('button', { name: 'Descurtir' }).waitFor();
  await card.getByRole('link', { name: 'Comentários' }).click();
  await B.fill('textarea[aria-label=Comentário]', `Que alegria estar aqui, @${admin.handle}!`);
  await B.click('button[aria-label="Enviar comentário"]');
  await B.getByText('Que alegria estar aqui').waitFor();
  await shot(B, 'post-comentarios');
  await A.goto(`${BASE}/notificacoes`);
  await A.getByText('Nova curtida').waitFor();
  await A.getByText('Novo comentário').waitFor();
  await shot(A, 'notificacoes');
});

await check('inscrição em evento e link no calendário', async () => {
  await B.goto(`${BASE}/agenda`);
  await B.getByText(EVENT).click();
  await B.click('button:has-text("Quero participar")');
  await B.getByRole('button', { name: 'Confirmar presença' }).waitFor();
  await B.click('button:has-text("Confirmar presença")');
  await B.getByText('Presença confirmada').first().waitFor();
  await shot(B, 'evento');
  const ics = await B.request.get(`${B.url()}/ics`);
  assert.match(await ics.text(), /BEGIN:VCALENDAR/);
});

await check('denúncia chega na moderação e o post é ocultado para as integrantes', async () => {
  await B.goto(`${BASE}/feed?escopo=members`);
  const card = B.locator('article', { hasText: POST });
  await card.getByRole('button', { name: 'Mais opções' }).click();
  await B.getByRole('button', { name: 'Denunciar' }).click();
  await B.getByRole('button', { name: 'Spam ou venda insistente' }).click();
  await B.getByRole('button', { name: 'Enviar denúncia' }).click();
  await B.getByText(/Denúncia enviada/).waitFor();
  await A.goto(`${BASE}/admin/moderacao`);
  const rep = A.locator('section', { hasText: POST }).filter({ hasText: 'Spam ou venda insistente' }).first();
  await rep.waitFor();
  A.once('dialog', (d) => d.accept());
  await rep.getByRole('button', { name: 'Ocultar conteúdo' }).click();
  await A.getByText('Conteúdo ocultado.').waitFor();
  await shot(A, 'admin-moderacao', true);
  await B.goto(`${BASE}/feed?escopo=members`);
  await B.waitForTimeout(500);
  assert.equal(await B.getByText(POST).count(), 0);
});

await check('Ensino abre a comunidade da Grioh configurada', async () => {
  await B.goto(`${BASE}/ensino`);
  const link = B.getByRole('link', { name: /Abrir a comunidade Grioh/ });
  assert.equal(await link.getAttribute('href'), 'https://comunidade.grioh.com.br/seven');
  await shot(B, 'ensino');
});

await check('perfil, edição e busca global', async () => {
  await B.goto(`${BASE}/perfil/editar`);
  await B.fill('input[name=headline]', 'Criativa, empreendedora e em constante evolução.');
  await B.fill('input[name=interests]', 'liderança, moda, investimentos');
  await B.click('button:has-text("Salvar perfil")');
  await B.waitForURL(/\/perfil$/);
  await B.getByText('Criativa, empreendedora').waitFor();
  await shot(B, 'perfil');
  await B.goto(`${BASE}/busca?q=aurora`);
  await B.getByText('Ateliê Aurora').first().waitFor();
  await shot(B, 'busca');
});

await check('integrante comum não acessa o painel administrativo', async () => {
  await B.goto(`${BASE}/admin`);
  await B.waitForURL(/\/feed/);
});

await check('PWA: manifest, service worker e página offline', async () => {
  const m = await (await B.request.get(`${BASE}/manifest.webmanifest`)).json();
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  const sw = await B.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; });
  assert.ok(sw, 'service worker registrado');
  assert.equal((await B.request.get(`${BASE}/offline.html`)).status(), 200);
});

await check('rotina agendada protegida e funcional', async () => {
  assert.equal((await B.request.get(`${BASE}/api/cron/dispatch`)).status(), 401);
  const r = await B.request.get(`${BASE}/api/cron/dispatch`, { headers: { authorization: 'Bearer local-cron-secret' } });
  assert.equal(r.status(), 200);
});

await check('exportação de dados (LGPD)', async () => {
  const r = await B.request.get(`${BASE}/api/export`);
  const j = await r.json();
  assert.equal(j.email, ana.email);
  assert.ok(Array.isArray(j.comments));
});

// Clube do Livro: livro do mês e votação preparados no banco, como a curadoria faria pelo painel
const BOOK = `Livro do mês ${run}`;
const [{ cm, nm, today }] = await q(`select date_trunc('month', public.club_today())::date::text cm, (date_trunc('month', public.club_today()) + interval '1 month')::date::text nm, public.club_today()::text today`);
const [mb] = await q(`insert into public.books (title, author, club) values ($1, 'Autora Teste', true) returning id`, [BOOK]);
await q(`insert into public.book_months (month, book_id, note) values ($1, $2, 'Escolhido para o teste') on conflict (month) do update set book_id = excluded.book_id, meeting_event_id = null`, [cm, mb.id]);
await q(`delete from public.book_polls where target_month = $1`, [nm]);
const opts = [];
for (const t of ['Opção Um', 'Opção Dois', 'Opção Três']) opts.push((await q(`insert into public.books (title, club) values ($1, true) returning id`, [`${t} ${run}`]))[0].id);
const [poll] = await q(`insert into public.book_polls (target_month, opens_on, closes_on) values ($1, $2::date - 1, $2::date + 3) returning id`, [nm, today]);
for (const [i, id] of opts.entries()) await q(`insert into public.book_poll_options (poll_id, book_id, position) values ($1, $2, $3)`, [poll.id, id, i + 1]);

await check('clube do livro: card no feed, "vou ler" e voto no próximo livro', async () => {
  await B.goto(`${BASE}/feed`);
  await B.getByText(`Clube do Livro · Livro de`).first().waitFor();
  // o título também existe, invisível, dentro da capa pequena: clica no cartão
  await B.locator('a', { hasText: BOOK }).first().click();
  await B.waitForURL(/\/clube-do-livro/);
  await B.getByRole('button', { name: 'Vou ler esse livro!' }).click();
  await B.getByText('Você vai ler este livro').waitFor();
  const r = await q(`select count(*)::int n from public.book_readers br join public.book_months m on m.id = br.month_id join public.profiles p on p.id = br.member_id where m.month = $1 and p.handle = $2`, [cm, ana.handle]);
  assert.equal(r[0].n, 1, 'leitora registrada');
  await B.locator('button', { hasText: `Opção Dois ${run}` }).click();
  await B.getByText('Seu voto').waitFor();
  const v = await q(`select b.title from public.book_votes v join public.books b on b.id = v.book_id join public.profiles p on p.id = v.member_id where v.poll_id = $1 and p.handle = $2`, [poll.id, ana.handle]);
  assert.equal(v[0]?.title, `Opção Dois ${run}`);
  await shot(B, 'clube-do-livro', true);
});

await check('biblioteca: registrar livro lido com estrelas e ver na estante de outra integrante', async () => {
  await B.goto(`${BASE}/biblioteca/registrar`);
  await B.getByRole('tab', { name: 'Outro livro' }).click();
  await B.fill('input[name=title]', `Livro antigo ${run}`);
  await B.fill('input[name=author]', 'Autora Antiga');
  await B.getByRole('radio', { name: '6 estrelas' }).click();
  await B.fill('textarea[name=review]', `Releria mil vezes ${run}`);
  await B.getByRole('button', { name: 'Registrar na minha biblioteca' }).click();
  await B.waitForURL(/\/perfil\?aba=biblioteca/);
  await shot(B, 'biblioteca', true);
  const [e] = await q(`select l.id, l.rating from public.library_entries l join public.books b on b.id = l.book_id where b.title = $1`, [`Livro antigo ${run}`]);
  assert.equal(e.rating, 6);
  await A.goto(`${BASE}/integrantes/${ana.handle}?aba=biblioteca`);
  await A.locator(`a[href="/biblioteca/${e.id}"]`).click();
  await A.getByText(`Releria mil vezes ${run}`).waitFor();
  await A.getByRole('img', { name: '6 de 7 estrelas' }).waitFor();
  assert.equal(await A.getByText('Editar avaliação e comentário').count(), 0, 'outra integrante não edita');
});

await check('admin: Clube do Livro mostra a votação e cadastra livro no catálogo', async () => {
  await A.goto(`${BASE}/admin/clube-do-livro`);
  await A.locator('li', { hasText: `Opção Dois ${run}` }).first().waitFor();
  await A.locator('form', { hasText: 'Adicionar ao catálogo' }).locator('input[name=title]').fill(`Catálogo ${run}`);
  await A.getByRole('button', { name: 'Adicionar ao catálogo' }).click();
  await A.locator('li p', { hasText: `Catálogo ${run}` }).first().waitFor();
  await shot(A, 'admin-clube-do-livro');
});

await check('planner: digitar, pilar, feito, cancelar e pular para amanhã', async () => {
  await B.goto(`${BASE}/planner`);
  await B.getByRole('radio', { name: 'Digitar' }).click();
  const row = (i) => B.locator(`[data-slot="${i}"]`);
  await row(0).getByRole('textbox').fill('ligar para a contadora');
  await row(1).getByRole('textbox').fill('treino 7h');
  await row(2).getByRole('textbox').fill('curso de oratória');
  await row(1).getByRole('button', { name: 'Escolher pilar' }).click();
  await row(1).getByRole('button', { name: 'BODY', exact: true }).click();
  await B.waitForTimeout(900);
  await row(1).getByRole('button', { name: 'Feito' }).click();
  await row(2).getByRole('button', { name: 'Cancelar' }).click();
  await row(0).getByRole('button', { name: 'Pular para amanhã' }).click();
  await B.getByText('Linha passou para amanhã').waitFor();
  await shot(B, 'planner-dia');
  await B.reload();
  assert.equal(await row(1).getByRole('button', { name: 'Feito' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await row(2).getByRole('button', { name: 'Cancelar' }).getAttribute('aria-pressed'), 'true');
  await row(0).getByRole('button', { name: 'Trazer de volta para hoje' }).waitFor();
  await B.getByRole('link', { name: 'Próximo dia' }).click();
  assert.equal(await B.locator('[data-slot="0"]').getByRole('textbox').inputValue(), 'ligar para a contadora');
  // a privacidade (nem a administração vê) é coberta nos testes de segurança do banco
});

await check('instalação sem loja: página pública, cartão no feed e mensagem do convite', async () => {
  const p = await newPage();
  await p.goto(`${BASE}/instalar`);
  await p.getByText('Adicionar à Tela de Início').first().waitFor();
  await shot(p, 'instalar', true);
  await A.goto(`${BASE}/feed?bemvinda=1`);
  await A.getByText('Leve o clube para a tela de início').waitFor();
  await A.getByText('Adicionar à Tela de Início').first().waitFor();
  await shot(A, 'feed-instalar');
  await A.getByRole('button', { name: 'Agora não' }).click();
  await A.goto(`${BASE}/feed`);
  assert.equal(await A.locator('[data-install-prompt]').count(), 0, 'o cartão deveria sumir depois de “Agora não”');
  await q(`insert into public.invitations (email, role, plan) values ($1, 'member', 'anual')`, [`pendente-${run}@teste.local`]);
  await A.goto(`${BASE}/admin/convites`);
  await A.getByRole('button', { name: 'Copiar mensagem' }).first().waitFor();
  const wa = await A.locator('a:has-text("WhatsApp")').first().getAttribute('href');
  assert.ok(decodeURIComponent(wa).includes('/instalar'), 'a mensagem do convite deveria levar à página de instalação');
});

await check('telas sem rolagem horizontal no celular', async () => {
  for (const p of ['/feed', '/business', '/seven', '/ensino', '/perfil', '/perfil?aba=biblioteca', '/clube-do-livro', '/biblioteca/registrar', '/agenda', '/afirmacoes', '/seven/evolucao', '/ajustes']) {
    await B.goto(`${BASE}${p}`);
    const over = await B.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `${p} transborda ${over}px`);
  }
  await B.goto(`${BASE}/seven/evolucao`);
  await shot(B, 'evolucao', true);
  await B.goto(`${BASE}/ajustes`);
  await shot(B, 'ajustes');
});

// Só rodam com a pilha Supabase real (Auth envia o e-mail para o SMTP local em MAIL_DIR)
if (process.env.MAIL_DIR) await check('cadastro público fechado: só entra quem tem convite', async () => {
  const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, { method: 'POST', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: `intrusa-${run}@teste.local`, password: 'senha-forte-000' }) });
  assert.equal(r.status, 422, 'cadastro direto no Auth recusado');
});

if (process.env.MAIL_DIR) await check('recuperação de senha por e-mail', async () => {
  const before = new Set(fs.readdirSync(process.env.MAIL_DIR));
  const C = await newPage();
  await C.goto(`${BASE}/recuperar`);
  await C.fill('input[name=email]', ana.email);
  await C.click('button[type=submit]');
  await C.getByText(/enviamos um link/).waitFor();
  let file;
  for (let i = 0; i < 40 && !file; i++) {
    await C.waitForTimeout(250);
    file = fs.readdirSync(process.env.MAIL_DIR).find((f) => f.endsWith('.eml') && !before.has(f));
  }
  assert.ok(file, 'e-mail de recuperação enviado');
  const raw = fs.readFileSync(path.join(process.env.MAIL_DIR, file), 'utf8').replace(/=\r?\n/g, '').replace(/=3D/g, '=');
  const link = raw.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');
  await C.goto(link);
  await C.waitForURL(/\/redefinir-senha/);
  await C.fill('input[name=password]', 'nova-senha-789');
  await C.fill('input[name=confirm]', 'nova-senha-789');
  await C.click('button[type=submit]');
  await C.waitForURL(/\/feed/);
  const D = await newPage();
  await D.goto(`${BASE}/entrar`);
  await D.fill('input[name=email]', ana.email);
  await D.fill('input[name=password]', 'nova-senha-789');
  await D.click('button[type=submit]');
  await D.waitForURL(/\/feed/);
});

await browser.close();
await db.end();
console.log(results.join('\n'));
const relevant = errors.filter((e) => !/Download the React DevTools/.test(e));
if (relevant.length) { console.log('\nErros no navegador:\n' + [...new Set(relevant)].slice(0, 15).join('\n')); }
console.log(`\n${results.filter((r) => r.includes(' ok ')).length}/${results.length} fluxos passaram · screenshots em ${shots}`);
