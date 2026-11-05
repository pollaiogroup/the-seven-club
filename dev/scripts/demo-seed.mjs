// Dados de DEMONSTRAÇÃO para visualizar a interface (pessoas e empresas fictícias).
// Uso: node dev/scripts/demo-seed.mjs  (lê .env.local; DEMO_DATABASE_URL aponta para o Postgres local)
// Apaga integrantes, conteúdo e convites da base local antes de criar a demonstração. Nunca rodar em produção.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
if (!/127\.0\.0\.1|localhost/.test(env.NEXT_PUBLIC_SUPABASE_URL)) throw new Error('Só roda contra um Supabase local.');
const db = new pg.Pool({ connectionString: process.env.DEMO_DATABASE_URL || 'postgres://postgres@127.0.0.1:54322/postgres' });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const q = (sql, params) => db.query(sql, params).then((r) => r.rows);
// Executa como a integrante (os gatilhos do banco conferem auth.uid(), como no app)
async function asUser(uid, sql, params) {
  const c = await db.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`, [uid, JSON.stringify({ sub: uid, role: 'authenticated' })]);
    const r = await c.query(sql, params);
    await c.query('commit');
    return r.rows;
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}
export const PASSWORD = 'demo-seven-2026';

// ------------------------------------------------------------ limpeza
await q(`delete from auth.users`);
await q(`delete from public.events; delete from public.invitations; delete from public.audit_log; delete from public.reports`);
await q(`delete from public.book_coupons; delete from public.book_polls; delete from public.book_months; delete from public.library_entries; delete from public.books`);
await q(`delete from public.affirmation_schedule where day > public.club_today()`);
await q(`delete from storage.objects`);
await q(`update public.app_settings set value = 'null'::jsonb where key = 'grioh_url'`);

// ------------------------------------------------------------ imagens (arte gráfica, não fotos)
const font = (f) => fs.readFileSync(path.join(root, 'node_modules', f)).toString('base64');
const PF = font('@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2');
const PFI = font('@fontsource-variable/playfair-display/files/playfair-display-latin-wght-italic.woff2');
const DM = font('@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function art(w, h, html) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:P;src:url(data:font/woff2;base64,${PF}) format('woff2');font-weight:400 900}
    @font-face{font-family:P;font-style:italic;src:url(data:font/woff2;base64,${PFI}) format('woff2');font-weight:400 900}
    @font-face{font-family:D;src:url(data:font/woff2;base64,${DM}) format('woff2');font-weight:100 1000}
    *{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden}body{font-family:D,sans-serif}
  </style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ type: 'jpeg', quality: 86 });
  await page.close();
  return buf;
}
async function upload(uid, buf, w, h) {
  const p = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await admin.storage.from('media').upload(p, new Blob([buf], { type: 'image/jpeg' }), { contentType: 'image/jpeg' });
  if (error) throw error;
  return { path: p, width: w, height: h };
}
const center = (bg, color, inner) => `<div style="width:100%;height:100%;background:${bg};color:${color};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">${inner}</div>`;

// ------------------------------------------------------------ integrantes
const PEOPLE = [
  { key: 'marina', name: 'Marina Duarte', handle: 'marina.duarte', role: 'super_admin', headline: 'Fundadora · estratégia e marcas', city: 'São Paulo', bio: 'Construo marcas com propósito e acredito no poder de mulheres juntas. Corrida às 6h, livro antes de dormir.', interests: ['liderança', 'marcas', 'corrida'] },
  { key: 'helena', name: 'Helena Prado', handle: 'helena.prado', role: 'admin', headline: 'Consultora de negócios', city: 'Rio de Janeiro', bio: 'Ajudo mulheres empreendedoras a precificar e crescer com saúde financeira.', interests: ['finanças', 'negócios'] },
  { key: 'beatriz', name: 'Beatriz Lacerda', handle: 'bia.lacerda', role: 'member', headline: 'Estilista', city: 'São Paulo', bio: 'Moda autoral, tecidos naturais e produção local.', interests: ['moda', 'sustentabilidade'] },
  { key: 'carolina', name: 'Carolina Mendes', handle: 'carol.mendes', role: 'moderator', headline: 'Nutricionista', city: 'Belo Horizonte', bio: 'Comida de verdade, sem terrorismo nutricional.', interests: ['saúde', 'culinária'] },
  { key: 'julia', name: 'Júlia Ferraz', handle: 'julia.ferraz', role: 'member', headline: 'Chef e confeiteira', city: 'Curitiba', bio: 'Café da tarde é um ritual.', interests: ['gastronomia', 'viagens'] },
  { key: 'renata', name: 'Renata Albuquerque', handle: 'renata.alb', role: 'member', headline: 'Professora de pilates', city: 'São Paulo', bio: 'Movimento como autocuidado.', interests: ['bem-estar', 'pilates'] },
];
const M = {};
for (const p of PEOPLE) {
  const email = `${p.handle.replace('.', '-')}@demo.theseven.club`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const id = data.user.id; M[p.key] = { ...p, id, email };
  await q(`insert into public.members (id, role, created_at) values ($1, $2, now() - interval '40 days')`, [id, p.role]);
  await q(`insert into public.profiles (id, handle, full_name, headline, bio, city, interests) values ($1,$2,$3,$4,$5,$6,$7)`, [id, p.handle, p.name, p.headline, p.bio, p.city, p.interests]);
  await q(`insert into public.user_preferences (member_id) values ($1)`, [id]);
  await q(`insert into public.memberships (member_id, plan, status, starts_at, ends_at) values ($1, $2, 'active', public.club_today() - 40, public.club_today() + 325)`, [id, p.key === 'marina' ? 'fundadora' : 'anual']);
}

// ------------------------------------------------------------ empresas
const cat = Object.fromEntries((await q(`select slug, id from public.business_categories`)).map((r) => [r.slug, r.id]));
const BIZ = [
  { key: 'lumiere', owner: 'beatriz', name: 'Atelier Lumière', cat: 'moda', tagline: 'Moda autoral em tecidos naturais', city: 'São Paulo', area: 'Envio para todo o Brasil', ig: 'atelierlumiere', featured: true,
    logo: center('#F4EBDD', '#450B18', `<div style="font-family:P;font-style:italic;font-size:120px;line-height:1">Lumière</div><div style="margin-top:18px;letter-spacing:.5em;font-size:22px">ATELIER</div>`),
    offers: [['product', 'Vestido Aurora', 'Linho lavado, modelagem ampla', 'R$ 890'], ['product', 'Camisa Seda Pura', 'Seda brasileira, botões de coco', 'R$ 640'], ['service', 'Consultoria de guarda-roupa', 'Encontro de 2h para montar seu armário-cápsula', 'R$ 450']] },
  { key: 'prado', owner: 'helena', name: 'Prado Consultoria', cat: 'negocios', tagline: 'Finanças e precificação para empreendedoras', city: 'Rio de Janeiro', area: 'Online, para todo o Brasil', ig: 'pradoconsultoria', featured: true,
    logo: center('#25251F', '#F4EBDD', `<div style="font-family:P;font-size:110px;font-weight:600;letter-spacing:.04em">PRADO</div><div style="margin-top:10px;letter-spacing:.6em;font-size:20px;color:#C9AFA8">CONSULTORIA</div>`),
    offers: [['service', 'Diagnóstico financeiro', 'Raio-x do negócio em 3 semanas', 'R$ 2.400'], ['service', 'Mentoria de precificação', '4 encontros individuais', 'R$ 1.800']] },
  { key: 'raiz', owner: 'carolina', name: 'Raiz Nutrição', cat: 'saude-bem-estar', tagline: 'Nutrição sem culpa e sem extremos', city: 'Belo Horizonte', area: 'Presencial em BH e online', ig: 'raiznutri',
    logo: center('#85866A', '#F4EBDD', `<div style="font-family:P;font-size:140px;line-height:1">raiz</div><div style="margin-top:14px;letter-spacing:.5em;font-size:20px">NUTRIÇÃO</div>`),
    offers: [['service', 'Consulta individual', 'Avaliação e plano alimentar', 'R$ 380'], ['product', 'Guia de lanches práticos', 'E-book com 40 receitas', 'R$ 49']] },
  { key: 'olivia', owner: 'julia', name: 'Casa Olívia', cat: 'alimentacao', tagline: 'Confeitaria e café da tarde sob encomenda', city: 'Curitiba', area: 'Curitiba e região', ig: 'casaolivia', featured: true,
    logo: center('#450B18', '#F4EBDD', `<div style="font-size:22px;letter-spacing:.6em;color:#C9AFA8">CASA</div><div style="font-family:P;font-style:italic;font-size:130px;line-height:1.05">Olívia</div>`),
    offers: [['product', 'Bolo de pistache e frutas vermelhas', 'Serve 20 pessoas', 'R$ 320'], ['product', 'Caixa café da tarde', '12 doces finos', 'R$ 180'], ['service', 'Mesa de doces para eventos', 'Sob consulta', 'Sob consulta']] },
  { key: 'duarte', owner: 'marina', name: 'Duarte Branding', cat: 'negocios', tagline: 'Estratégia e identidade para marcas femininas', city: 'São Paulo', area: 'Todo o Brasil', ig: 'duartebranding',
    logo: center('#F4EBDD', '#25251F', `<div style="font-family:P;font-size:150px;line-height:1">D.</div><div style="margin-top:14px;letter-spacing:.5em;font-size:20px">BRANDING</div>`),
    offers: [['service', 'Plataforma de marca', 'Propósito, posicionamento e voz', 'Sob consulta'], ['service', 'Identidade visual', 'Logo, paleta e tipografia', 'Sob consulta']] },
  { key: 'corpo', owner: 'renata', name: 'Estúdio Corpo Leve', cat: 'saude-bem-estar', tagline: 'Pilates e mobilidade em turmas pequenas', city: 'São Paulo', area: 'Vila Madalena, São Paulo', ig: 'corpoleve',
    logo: center('#C9AFA8', '#450B18', `<div style="font-family:P;font-size:100px;line-height:1">Corpo</div><div style="font-family:P;font-style:italic;font-size:100px;line-height:1">Leve</div>`),
    offers: [['service', 'Aula experimental', '50 min, turma de até 4', 'Gratuita'], ['service', 'Plano mensal', '2 aulas por semana', 'R$ 520']] },
];
const B = {};
for (const b of BIZ) {
  const owner = M[b.owner].id;
  const logo = await upload(owner, await art(600, 600, b.logo), 600, 600);
  const tone = { moda: ['#C9AFA8', '#450B18'], negocios: ['#25251F', '#C9AFA8'], 'saude-bem-estar': ['#85866A', '#F4EBDD'], alimentacao: ['#450B18', '#C9AFA8'] }[b.cat];
  const coverImg = await upload(owner, await art(1200, 600, `<div style="position:relative;width:100%;height:100%;background:${tone[0]};overflow:hidden">
    <div style="position:absolute;right:-160px;top:-220px;width:760px;height:760px;border-radius:50%;background:${tone[1]};opacity:.14"></div>
    <div style="position:absolute;right:120px;bottom:-300px;width:520px;height:520px;border-radius:50%;border:2px solid ${tone[1]};opacity:.35"></div></div>`), 1200, 600);
  const [row] = await q(`insert into public.businesses (slug, name, tagline, description, category_id, owner_id, logo_path, cover_path, instagram, city, service_area, featured, whatsapp, created_at)
    values ($1,$2,$3,$4,$5,$6,$7,$12,$8,$9,$10,$11,'11999990000', now() - interval '30 days') returning id`,
    [{ lumiere: 'atelier-lumiere', corpo: 'estudio-corpo-leve', olivia: 'casa-olivia', prado: 'prado-consultoria', raiz: 'raiz-nutricao', duarte: 'duarte-branding' }[b.key],
      b.name, b.tagline, `${b.tagline}. Empresa de demonstração criada para visualizar o diretório do clube.`, cat[b.cat], owner, logo.path, b.ig, b.city, b.area, !!b.featured, coverImg.path]);
  B[b.key] = { ...b, id: row.id, owner };
  for (const [i, [kind, name, desc, price]] of b.offers.entries())
    await q(`insert into public.business_offerings (business_id, kind, name, description, price_text, position) values ($1,$2,$3,$4,$5,$6)`, [row.id, kind, name, desc, price, i]);
}
// galeria do ateliê
const swatches = ['#E8DCCB', '#C9AFA8', '#85866A', '#450B18'];
for (const [i, c] of swatches.entries()) {
  const g = await upload(B.lumiere.owner, await art(800, 1000, center(c, i > 1 ? '#F4EBDD' : '#450B18', `<div style="font-family:P;font-style:italic;font-size:64px">${['Linho', 'Rosé', 'Oliva', 'Bordô'][i]}</div><div style="margin-top:12px;font-size:20px;letter-spacing:.3em">COLEÇÃO VERÃO</div>`)), 800, 1000);
  await q(`insert into public.business_media (business_id, path, width, height, position) values ($1,$2,$3,$4,$5)`, [B.lumiere.id, g.path, g.width, g.height, i]);
}

// ------------------------------------------------------------ projetos
const cover = (t, s, bg) => center(bg, '#F4EBDD', `<div style="font-family:P;font-size:76px;line-height:1.05;max-width:900px">${t}</div><div style="margin-top:22px;font-size:22px;letter-spacing:.3em;color:#C9AFA8">${s}</div>`);
const prj1c = await upload(M.marina.id, await art(1200, 750, cover('Mentoria Jovens Líderes', 'PROJETO SOCIAL', '#450B18')), 1200, 750);
const [p1] = await q(`insert into public.projects (slug, name, description, category, visibility, owner_id, cover_path, created_at) values
  ('mentoria-jovens-lideres', 'Mentoria Jovens Líderes', 'Integrantes do clube mentoram estudantes de escolas públicas em liderança, carreira e finanças. Encontros mensais, de março a novembro.', 'social', 'club', $1, $2, now() - interval '20 days') returning id`, [M.marina.id, prj1c.path]);
const prj2c = await upload(M.julia.id, await art(1200, 750, cover('Livro de receitas das integrantes', 'COLABORAÇÃO', '#85866A')), 1200, 750);
const [p2] = await q(`insert into public.projects (slug, name, description, category, visibility, owner_id, cover_path, created_at) values
  ('livro-de-receitas', 'Livro de receitas das integrantes', 'Uma coletânea com a receita afetiva de cada integrante, com renda revertida para o projeto de mentoria.', 'colaboracao', 'club', $1, $2, now() - interval '12 days') returning id`, [M.julia.id, prj2c.path]);
for (const k of ['helena', 'carolina', 'renata']) await q(`insert into public.project_members (project_id, member_id, role, added_by) values ($1,$2,'collaborator',$3) on conflict do nothing`, [p1.id, M[k].id, M.marina.id]);
for (const k of ['marina', 'carolina']) await q(`insert into public.project_members (project_id, member_id, role, added_by) values ($1,$2,'collaborator',$3) on conflict do nothing`, [p2.id, M[k].id, M.julia.id]);

// ------------------------------------------------------------ SEVEN (check-ins privados)
const pil = Object.fromEntries((await q(`select slug, id from public.pillars`)).map((r) => [r.slug, r.id]));
const today = (await q(`select public.club_today() d`))[0].d;
const order = ['body', 'mind', 'leadership', 'business', 'wealth', 'connection', 'lifestyle'];
for (let d = 1; d <= 26; d++) {
  for (const [i, s] of order.entries()) {
    if (((d * 7 + i * 3) % 10) < (d % 6 === 0 ? 2 : 6)) {
      await q(`insert into public.check_ins (member_id, pillar_id, day, completed_at) values ($1,$2,$3::date - $4::int, ($3::date - $4::int) + time '07:30' + ($5 || ' hours')::interval)`, [M.marina.id, pil[s], today, d, String(i * 2)]);
    }
  }
}
const ci = {};
for (const [s, note, hour] of [['body', 'Corrida de 6 km no parque. Ritmo melhor que semana passada.', 6], ['mind', 'Capítulo 4 do livro sobre negociação.', 7], ['leadership', 'Dei o feedback difícil que vinha adiando.', 11], ['business', 'Fechei a proposta com o novo cliente.', 15]]) {
  const [r] = await q(`insert into public.check_ins (member_id, pillar_id, day, completed_at, note) values ($1,$2,$3, now() - make_interval(hours => greatest(0, extract(hour from now() at time zone 'America/Sao_Paulo')::int - $4)), $5) returning id`, [M.marina.id, pil[s], today, hour, note]);
  ci[s] = r.id;
}

// ------------------------------------------------------------ feed
const posts = {};
async function post(key, author, body, hoursAgo, extra = {}) {
  const [r] = await asUser(author, `insert into public.posts (author_id, context, business_id, project_id, source, pillar_id, check_in_id, affirmation_id, body, created_at)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - make_interval(mins => $10)) returning id`,
    [author, extra.context || 'member', extra.business || null, extra.project || null, extra.source || 'manual', extra.pillar || null, extra.checkIn || null, extra.affirmation || null, body, Math.round(hoursAgo * 60)]);
  if (extra.image) await q(`insert into public.post_media (post_id, path, width, height) values ($1,$2,$3,$4)`, [r.id, extra.image.path, extra.image.width, extra.image.height]);
  posts[key] = r.id; return r.id;
}
const flyer = await upload(M.helena.id, await art(1080, 1350, `<div style="width:100%;height:100%;background:#25251F;color:#F4EBDD;padding:90px;display:flex;flex-direction:column;justify-content:space-between">
  <div style="letter-spacing:.4em;font-size:24px;color:#C9AFA8">WORKSHOP · ONLINE</div>
  <div><div style="font-family:P;font-size:110px;line-height:1">Precificação</div><div style="font-family:P;font-style:italic;font-size:110px;line-height:1.05;color:#C9AFA8">com confiança</div>
  <div style="margin-top:40px;font-size:30px;line-height:1.5;max-width:760px">Quanto cobrar, como apresentar o preço e como sustentar o valor do seu trabalho.</div></div>
  <div style="font-size:26px;letter-spacing:.15em">PRADO CONSULTORIA</div></div>`), 1080, 1350);
const book = await upload(M.carolina.id, await art(1080, 1080, center('#F4EBDD', '#450B18', `<div style="font-family:P;font-style:italic;font-size:200px;line-height:.6;color:#C9AFA8">“</div><div style="font-family:P;font-size:62px;line-height:1.25;max-width:820px">Cuidar de si não é luxo. É estrutura.</div><div style="margin-top:36px;font-size:22px;letter-spacing:.3em">RAIZ NUTRIÇÃO</div>`)), 1080, 1080);
const cake = await upload(M.julia.id, await art(1080, 1080, center('#450B18', '#F4EBDD', `<div style="font-size:24px;letter-spacing:.5em;color:#C9AFA8">CASA OLÍVIA</div><div style="font-family:P;font-size:96px;line-height:1.05;margin-top:24px">Menu de<br><i>Natal</i></div><div style="margin-top:30px;font-size:26px">Encomendas até 15 de dezembro</div>`)), 1080, 1080);

await post('seven_body', M.marina.id, 'Corrida de domingo cedo, antes da cidade acordar. Começar o dia assim muda tudo.', 2.5, { source: 'seven', pillar: pil.body, checkIn: ci.body });
await post('prado', M.helena.id, 'Abrimos as inscrições do workshop de precificação para as integrantes do clube. Turma pequena, com análise dos preços de cada participante. Link no perfil da empresa.', 4, { context: 'business', business: B.prado.id, image: flyer });
await post('mentoria', M.marina.id, 'Primeiro encontro da mentoria com as estudantes foi emocionante. Obrigada @helena.prado e @carol.mendes por toparem conduzir as rodas de conversa.', 7, { context: 'project', project: p1.id });
await post('bia', M.beatriz.id, 'Peças da coleção verão chegando ao ateliê. Quem quiser ver de perto, a casa está aberta na sexta à tarde para as integrantes.', 22, { context: 'business', business: B.lumiere.id });
await post('raiz', M.carolina.id, 'Lembrete da semana para quem vive correndo: planejar dois lanches antes de sair de casa resolve metade do dia.', 27, { context: 'business', business: B.raiz.id, image: book });
const affi = (await q(`select affirmation_id from public.affirmation_schedule where day = public.club_today()`))[0]?.affirmation_id
  || (await q(`select public.ensure_affirmation(public.club_today()) as id`))[0].id;
await post('affirm', M.renata.id, 'Essa frase chegou no dia certo.', 30, { source: 'affirmation', affirmation: affi });
await post('olivia', M.julia.id, 'O menu de Natal da Casa Olívia está pronto. Integrantes do clube têm prioridade nas encomendas.', 46, { context: 'business', business: B.olivia.id, image: cake });
await post('livro', M.julia.id, 'Já recebi 9 receitas para o livro. Falta a sua! Pode ser simples: o que importa é a história por trás.', 52, { context: 'project', project: p2.id });
const [hci] = await q(`insert into public.check_ins (member_id, pillar_id, day, completed_at) values ($1,$2,public.club_today(), now() - interval '5 hours') returning id`, [M.helena.id, pil.mind]);
await post('helena_mind', M.helena.id, 'Terminei o livro sobre vulnerabilidade na liderança que a Marina indicou. Recomendo muito para quem lidera equipes.', 5, { source: 'seven', pillar: pil.mind, checkIn: hci.id });

// curtidas, comentários e salvos
const likes = [['seven_body', ['helena', 'carolina', 'renata', 'julia']], ['prado', ['marina', 'beatriz', 'julia']], ['mentoria', ['helena', 'carolina', 'beatriz', 'renata', 'julia']], ['bia', ['marina', 'renata']], ['raiz', ['marina', 'helena']], ['olivia', ['marina', 'beatriz', 'carolina']], ['affirm', ['marina']]];
for (const [k, who] of likes) for (const w of who) await asUser(M[w].id, `insert into public.likes (post_id, member_id) values ($1,$2) on conflict do nothing`, [posts[k], M[w].id]);
const comments = [['seven_body', 'helena', 'Que disciplina! Bora correr juntas na próxima?', 2], ['seven_body', 'marina', 'Bora! Sábado às 6h no Ibirapuera.', 1.8], ['prado', 'marina', 'Vou indicar para todas as meninas do meu grupo.', 3], ['mentoria', 'carolina', 'Foi lindo ver a confiança delas crescendo em uma tarde.', 6], ['olivia', 'beatriz', 'Já quero o de pistache!', 40]];
for (const [k, w, body, h] of comments) await asUser(M[w].id, `insert into public.comments (post_id, author_id, body, created_at) values ($1,$2,$3, now() - make_interval(mins => $4))`, [posts[k], M[w].id, body, Math.round(h * 60)]);
await q(`insert into public.saved_posts (post_id, member_id) values ($1,$2)`, [posts.prado, M.marina.id]);
await q(`insert into public.affirmation_favorites (member_id, affirmation_id) values ($1,$2) on conflict do nothing`, [M.marina.id, affi]);

// ------------------------------------------------------------ agenda
// capa sem texto: no cartão da agenda ela aparece atrás do dia, e texto ali vira ruído
const evc = await upload(M.marina.id, await art(1200, 750, `<div style="position:relative;width:100%;height:100%;background:#450B18;overflow:hidden">
  <div style="position:absolute;left:-180px;top:-260px;width:820px;height:820px;border-radius:50%;background:#C9AFA8;opacity:.16"></div>
  <div style="position:absolute;right:-120px;bottom:-340px;width:700px;height:700px;border-radius:50%;border:2px solid #C9AFA8;opacity:.4"></div>
  <div style="position:absolute;right:220px;top:120px;width:220px;height:220px;border-radius:50%;background:#85866A;opacity:.28"></div></div>`), 1200, 750);
const EVENTS = [
  ['Jantar das Fundadoras', 'Um jantar a oito mãos com as chefs do clube, para celebrar o primeiro ano.', 'experiencia', 9, 'Casa Olívia · Curitiba', null, 24, evc.path, '20:00', 3],
  ['Workshop: Precificação com confiança', 'Com Helena Prado. Traga a sua tabela de preços.', 'workshop', 3, null, 'https://meet.example.com/seven-precificacao', 30, null, '19:30', 1.5],
  ['Corrida do clube', '5 km leves no Ibirapuera, seguidos de café.', 'atividade', 5, 'Parque Ibirapuera · Portão 3', null, null, null, '07:00', 1.5],
  ['Palestra: Liderança no feminino', 'Conversa aberta sobre carreira, maternidade e poder.', 'palestra', -6, 'Auditório do clube · São Paulo', null, 80, null, '19:00', 2],
];
const E = [];
// horários no fuso do clube, qualquer que seja o fuso da sessão do banco
const at = `((public.club_today() + make_interval(days => $4))::timestamp + $10::time) at time zone 'America/Sao_Paulo'`;
for (const [title, desc, kind, days, loc, url, cap, cov, time, hours] of EVENTS) {
  const [r] = await q(`insert into public.events (title, description, kind, starts_at, ends_at, location, online_url, capacity, cover_path, published, created_by)
    values ($1,$2,$3, ${at}, ${at} + make_interval(mins => $11), $5,$6,$7,$8, true, $9) returning id`,
    [title, desc, kind, days, loc, url, cap, cov, M.marina.id, time, Math.round(hours * 60)]);
  E.push(r.id);
}
for (const k of ['marina', 'helena', 'julia', 'beatriz']) await q(`insert into public.event_registrations (event_id, member_id, status) values ($1,$2,'confirmed')`, [E[0], M[k].id]);
for (const k of ['carolina', 'renata']) await q(`insert into public.event_registrations (event_id, member_id) values ($1,$2)`, [E[0], M[k].id]);
for (const k of ['marina', 'beatriz', 'renata']) await q(`insert into public.event_registrations (event_id, member_id) values ($1,$2)`, [E[1], M[k].id]);
for (const k of ['marina', 'helena']) await q(`insert into public.event_registrations (event_id, member_id, status) values ($1,$2,'confirmed')`, [E[3], M[k].id]);

// ------------------------------------------------------------ clube do livro
const mkBook = async (title, author, club = true, by = M.marina.id) =>
  (await q(`insert into public.books (title, author, club, created_by) values ($1,$2,$3,$4) returning id`, [title, author, club, by]))[0].id;
const BK = {
  tudo: await mkBook('Tudo é rio', 'Carla Madeira'), torto: await mkBook('Torto arado', 'Itamar Vieira Junior'),
  hora: await mkBook('A hora da estrela', 'Clarice Lispector'), quarto: await mkBook('Quarto de despejo', 'Carolina Maria de Jesus'),
  lobos: await mkBook('Mulheres que correm com os lobos', 'Clarissa Pinkola Estés'), passaro: await mkBook('O peso do pássaro morto', 'Aline Bei'),
};
const [bev] = await q(`insert into public.events (title, description, kind, starts_at, ends_at, location, capacity, published, created_by)
  values ('Clube do Livro: Tudo é rio', 'Conversa sobre o livro do mês, com café da Casa Olívia.', 'presencial',
          ((public.club_today() + 21)::timestamp + time '19:30') at time zone 'America/Sao_Paulo', ((public.club_today() + 21)::timestamp + time '21:30') at time zone 'America/Sao_Paulo', 'Casa Olívia · Curitiba', 20, true, $1) returning id`, [M.marina.id]);
const cm = (await q(`select date_trunc('month', public.club_today())::date::text m`))[0].m;
const [bm] = await q(`insert into public.book_months (month, book_id, note, meeting_event_id, announced_at, created_by) values ($1, $2, $3, $4, now(), $5) returning id`,
  [cm, BK.tudo, 'Uma história sobre amor, culpa e reconstrução, escrita com uma delicadeza rara. Escolhido pela votação do mês passado.', bev.id, M.marina.id]);
await q(`insert into public.book_months (month, book_id, announced_at) values (($1::date - interval '1 month')::date, $2, now()), (($1::date - interval '2 months')::date, $3, now())`, [cm, BK.torto, BK.hora]);
for (const k of ['helena', 'julia', 'carolina', 'renata', 'beatriz']) await q(`insert into public.book_readers (month_id, member_id) values ($1, $2)`, [bm.id, M[k].id]);
const [bp] = await q(`insert into public.book_polls (target_month, opens_on, closes_on, opened_notified_at, created_by) values (($1::date + interval '1 month')::date, public.club_today() - 1, public.club_today() + 4, now(), $2) returning id`, [cm, M.marina.id]);
for (const [i, k] of ['quarto', 'lobos', 'passaro'].entries()) await q(`insert into public.book_poll_options (poll_id, book_id, position) values ($1,$2,$3)`, [bp.id, BK[k], i + 1]);
for (const [k, b] of [['helena', 'quarto'], ['julia', 'lobos'], ['carolina', 'quarto']]) await q(`insert into public.book_votes (poll_id, member_id, book_id) values ($1,$2,$3)`, [bp.id, M[k].id, BK[b]]);
await q(`insert into public.book_coupons (book_id, store, code, details, starts_on, valid_until, notified_at, created_by) values ($1, 'Livraria parceira', 'SEVEN15', '15% de desconto no livro impresso', public.club_today(), (date_trunc('month', public.club_today()) + interval '1 month - 1 day')::date, now(), $2)`, [BK.tudo, M.marina.id]);
const lib = async (who, book, rating, review, monthsAgo) => q(`insert into public.library_entries (member_id, book_id, rating, review, finished_on) values ($1,$2,$3,$4, (date_trunc('month', now()) - make_interval(months => $5))::date)`, [M[who].id, book, rating, review, monthsAgo]);
await lib('marina', BK.torto, 7, 'Bibiana e Belonísia ficaram comigo por semanas. A conversa do clube sobre terra e herança foi das mais bonitas que já tivemos.', 1);
await lib('marina', BK.hora, 6, 'Curto e devastador. Reli a última página três vezes.', 2);
await lib('marina', BK.lobos, 7, 'Li muito antes do clube, e volto a ele sempre que preciso lembrar de mim.', 30);
await lib('marina', await mkBook('A coragem de ser imperfeito', 'Brené Brown', false), 5, 'Mudou como eu dou feedback para a equipe.', 8);
await lib('marina', await mkBook('O poder do hábito', 'Charles Duhigg', false), 4, null, 14);
await lib('helena', BK.torto, 6, 'Final forte. Quero ler mais do autor.', 1);
await lib('helena', BK.hora, 5, null, 2);
await q(`select public.notify($1, null, 'book_club', 'Vote no livro do próximo mês', 'Três opções escolhidas pela curadoria.', '/clube-do-livro')`, [M.marina.id]);

// convite pendente e uma denúncia para o painel
await q(`insert into public.invitations (email, role, plan, created_by) values ('nova.integrante@demo.theseven.club', 'member', 'anual', $1)`, [M.marina.id]);
await q(`insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'comment', (select id from public.comments where body like 'Já quero%'), 'Propaganda fora do contexto')`, [M.renata.id]).catch(() => {});

await browser.close();
await db.end();
console.log(`Demonstração pronta. Entre como ${M.marina.email} / ${PASSWORD}`);
