// Captura as telas do app (com os dados de demo-seed.mjs) para o tour visual.
// Gera, por tela, o conteúdo inteiro (sem a barra inferior) e a barra inferior separada.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import pg from 'pg';

const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const B = 'http://localhost:3000';
const db = new pg.Pool({ connectionString: process.env.DEMO_DATABASE_URL || 'postgres://postgres@127.0.0.1:54322/postgres' });
const one = async (sql) => (await db.query(sql)).rows[0];
const token = (await one(`select token from public.invitations where accepted_at is null limit 1`)).token;
const ev = (await one(`select id from public.events where title like 'Jantar%'`)).id;
const post = (await one(`select id from public.posts where body like 'Corrida de domingo%'`)).id;
const entry = (await one(`select l.id from public.library_entries l join public.books b on b.id = l.book_id join public.profiles p on p.id = l.member_id where b.title = 'Torto arado' and p.handle = 'marina.duarte'`)).id;
await db.end();

const SCREENS = [
  ['entrar', '/entrar', false], ['convite', `/convite/${token}`, false],
  ['feed', '/feed'], ['post', `/post/${post}`], ['publicar', '/publicar'], ['afirmacoes', '/afirmacoes'],
  ['agenda', '/agenda'], ['evento', `/agenda/${ev}`], ['busca', '/busca?q=pilates'], ['notificacoes', '/notificacoes'],
  ['business', '/business'], ['empresa', '/business/atelier-lumiere'], ['empresa-ofertas', '/business/atelier-lumiere?aba=ofertas'],
  ['empresa-galeria', '/business/atelier-lumiere?aba=galeria'], ['empresa-feed', '/business/casa-olivia?aba=feed'], ['empresa-interacoes', '/business/prado-consultoria/editar'],
  ['seven', '/seven'], ['seven-pilar', '/seven/wealth'], ['seven-evolucao', '/seven/evolucao'], ['seven-historico', '/seven/historico'],
  ['clube-do-livro', '/clube-do-livro'], ['biblioteca', '/perfil?aba=biblioteca'], ['biblioteca-livro', `/biblioteca/${entry}`], ['biblioteca-registrar', '/biblioteca/registrar'],
  ['ensino', '/ensino'],
  ['perfil', '/perfil'], ['perfil-empresas', '/perfil?aba=empresas'], ['projeto', '/projetos/mentoria-jovens-lideres'], ['integrante', '/integrantes/helena.prado'], ['ajustes', '/ajustes'],
];
const ADMIN = [['admin', '/admin'], ['admin-integrantes', '/admin/integrantes'], ['admin-convites', '/admin/convites'], ['admin-moderacao', '/admin/moderacao'], ['admin-afirmacoes', '/admin/afirmacoes'], ['admin-clube-do-livro', '/admin/clube-do-livro'], ['admin-eventos', '/admin/eventos'], ['admin-conteudo', '/admin/conteudo']];

// SHOTS=agenda,evento fotografa só essas telas
const ONLY = process.env.SHOTS ? new Set(process.env.SHOTS.split(',')) : null;
const pick = (list) => (ONLY ? list.filter(([n]) => ONLY.has(n)) : list);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=pt-BR'], env: { ...process.env, LANG: 'pt_BR.UTF-8', LANGUAGE: 'pt_BR' } });
async function login(ctx) {
  const p = await ctx.newPage();
  await p.goto(`${B}/entrar`, { waitUntil: 'networkidle' });
  await p.fill('input[name=email]', 'marina-duarte@demo.theseven.club');
  await p.fill('input[name=password]', 'demo-seven-2026');
  await p.click('button[type=submit]');
  await p.waitForURL(/\/feed/);
  return p;
}
const settle = async (p) => { await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(350); };

// celular
const anon = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' });
const page = await login(ctx);
const ap = await anon.newPage();
const meta = [];
for (const [name, url, authed = true] of pick(SCREENS)) {
  const p = authed ? page : ap;
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(B + url); await settle(p);
  const nav = p.locator('nav[aria-label="Navegação principal"]');
  const hasNav = authed && (await nav.count()) > 0;
  if (hasNav) await nav.screenshot({ path: `${OUT}/${name}.nav.png` });
  await p.addStyleTag({ content: 'nav[aria-label="Navegação principal"]{display:none!important} [data-install-prompt]{display:none!important}' });
  const h = Math.min(await p.evaluate(() => document.documentElement.scrollHeight), 3600);
  await p.setViewportSize({ width: 390, height: Math.max(844, h) });
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  meta.push({ name, url, height: Math.max(844, h), nav: hasNav });
  console.log('ok', name, h);
}
// painel administrativo no computador
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' });
const dp = await login(desk);
for (const [name, url] of pick(ADMIN)) {
  await dp.setViewportSize({ width: 1280, height: 800 });
  await dp.goto(B + url); await settle(dp);
  const h = Math.min(await dp.evaluate(() => document.documentElement.scrollHeight), 2400);
  await dp.setViewportSize({ width: 1280, height: Math.max(800, h) });
  await dp.waitForTimeout(200);
  await dp.screenshot({ path: `${OUT}/${name}.png` });
  meta.push({ name, url, height: Math.max(800, h), desktop: true });
  console.log('ok', name, h);
}
if (!ONLY) fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 2));
await browser.close();
