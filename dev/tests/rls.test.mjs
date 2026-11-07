// Testes das regras de segurança (RLS, gatilhos e funções) direto no Postgres.
// Cada cenário roda como uma integrante diferente, com o mesmo papel e JWT usados em produção.
// Uso: com o ambiente local no ar (dev/local-supabase/start.sh), rode `npm run test:db`.

import assert from 'node:assert/strict';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL || `postgres://postgres:postgres@127.0.0.1:${process.env.LOCAL_PG_PORT || 54329}/seven` });
pg.types.setTypeParser(1082, (v) => v);
const sys = (sql, p) => pool.query(sql, p).then((r) => r.rows);

async function as(user, sql, params = []) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`set local role ${user ? 'authenticated' : 'anon'}`);
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(user ? { sub: user.id, email: user.email, role: 'authenticated' } : { role: 'anon' })]);
    const r = await c.query(sql, params);
    await c.query('commit');
    return r.rows;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}
const denied = async (p, re) => {
  try { await p; } catch (e) { if (re) assert.match(e.message, re); return e; }
  assert.fail('era esperado um erro de permissão');
};

let passed = 0;
const results = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  ok  ${name}`);
  } catch (e) {
    results.push(`  FALHOU  ${name}\n        ${e.message}`);
    process.exitCode = 1;
  }
}

const run = Date.now().toString(36);
async function authUser(tag) {
  const email = `${tag}-${run}@teste.local`;
  const [u] = await sys(`insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at) values (gen_random_uuid(), 'authenticated', 'authenticated', $1, extensions.crypt('senha-teste-123', extensions.gen_salt('bf')), now()) returning id, email`, [email]);
  return u;
}
async function member(tag, role = 'member') {
  const u = await authUser(tag);
  const [inv] = await sys(`insert into public.invitations (email, role) values ($1, $2) returning token`, [u.email, role]);
  await as(u, `select public.accept_invitation($1, $2, $3)`, [inv.token, `Teste ${tag}`, `${tag}_${run}`.slice(0, 30)]);
  return u;
}

const admin = await member('adm', 'super_admin');
const mod = await member('mod', 'moderator');
const ana = await member('ana');
const bia = await member('bia');
const outsider = await authUser('fora');

await test('convite: só aceita com o mesmo e-mail e uma única vez', async () => {
  const u = await authUser('conv');
  const [inv] = await sys(`insert into public.invitations (email) values ('outra-${run}@teste.local') returning token`);
  await denied(as(u, `select public.accept_invitation($1, 'X Y', $2)`, [inv.token, `conv_${run}`]), /outro e-mail/);
  const [inv2] = await sys(`insert into public.invitations (email) values ($1) returning token`, [u.email]);
  await as(u, `select public.accept_invitation($1, 'Conv Ok', $2)`, [inv2.token, `convok_${run}`]);
  await denied(as(u, `select public.accept_invitation($1, 'Conv Ok', $2)`, [inv2.token, `convok2_${run}`]), /inválido/);
  const [look] = await as(null, `select public.invitation_lookup($1) as r`, [inv2.token]);
  assert.equal(look.r.valid, false);
});

await test('visitante sem login e conta sem convite não leem nada', async () => {
  assert.equal((await as(null, `select count(*)::int n from public.profiles`).catch(() => [{ n: 0 }]))[0].n, 0);
  assert.equal((await as(outsider, `select count(*)::int n from public.profiles`))[0].n, 0);
  assert.equal((await as(outsider, `select count(*)::int n from public.posts`))[0].n, 0);
  await denied(as(outsider, `insert into public.posts (author_id, body) values ($1, 'oi')`, [outsider.id]));
});

let anaCheckIn;
await test('check-in é privado: nem outra integrante nem a admin leem', async () => {
  [anaCheckIn] = await as(ana, `insert into public.check_ins (member_id, pillar_id, note) values ($1, 1, 'nota privada') returning id`, [ana.id]);
  assert.equal((await as(bia, `select count(*)::int n from public.check_ins where id = $1`, [anaCheckIn.id]))[0].n, 0);
  assert.equal((await as(admin, `select count(*)::int n from public.check_ins where id = $1`, [anaCheckIn.id]))[0].n, 0);
  await denied(as(bia, `update public.check_ins set note = 'x' where id = $1 returning id`, [anaCheckIn.id]).then((r) => { if (!r.length) throw new Error('bloqueado'); }));
});

await test('publicar no SEVEN exige check-in concluído da própria autora', async () => {
  await denied(as(ana, `insert into public.posts (author_id, source, pillar_id, check_in_id, body) values ($1, 'seven', 1, $2, 'treino')`, [ana.id, anaCheckIn.id]), /concluídas/);
  await as(ana, `update public.check_ins set completed_at = now() where id = $1`, [anaCheckIn.id]);
  await denied(as(bia, `insert into public.posts (author_id, source, pillar_id, check_in_id, body) values ($1, 'seven', 1, $2, 'roubando')`, [bia.id, anaCheckIn.id]), /concluídas/);
  const [p] = await as(ana, `insert into public.posts (author_id, source, pillar_id, check_in_id, body) values ($1, 'seven', 3, $2, 'Concluí meu treino') returning id, pillar_id`, [ana.id, anaCheckIn.id]);
  assert.equal(p.pillar_id, 1, 'pilar vem do check-in, não do que foi enviado');
  const [post] = await as(bia, `select to_jsonb(p) j from public.posts p where id = $1`, [p.id]);
  assert.ok(!JSON.stringify(post.j).includes('nota privada'), 'nota privada não vaza para o post');
});

let anaPost;
await test('feed: post comum aparece para integrantes; autora não muda autoria nem se esconde da moderação', async () => {
  [anaPost] = await as(ana, `insert into public.posts (author_id, body) values ($1, 'Olá, clube! @bia_${run}') returning id`, [ana.id]);
  const [f] = await as(bia, `select public.feed_page() r`);
  assert.ok(f.r.some((x) => x.id === anaPost.id));
  await denied(as(ana, `update public.posts set author_id = $2 where id = $1`, [anaPost.id, bia.id]), /texto/);
  await denied(as(ana, `update public.posts set hidden_at = now() where id = $1`, [anaPost.id]), /moderar/);
  await denied(as(bia, `insert into public.posts (author_id, body) values ($1, 'falsa')`, [ana.id]));
});

await test('menção e curtida geram notificação só para a destinatária', async () => {
  await as(bia, `insert into public.likes (post_id, member_id) values ($1, $2)`, [anaPost.id, bia.id]);
  const anaN = await as(ana, `select kind from public.notifications where recipient_id = $1`, [ana.id]);
  assert.ok(anaN.some((n) => n.kind === 'like'));
  const biaN = await as(bia, `select kind from public.notifications`);
  assert.ok(biaN.some((n) => n.kind === 'mention'));
  assert.ok(biaN.every((n) => n.kind !== 'like'), 'bia não lê notificações da ana');
  await denied(as(bia, `insert into public.notifications (recipient_id, kind) values ($1, 'like')`, [ana.id]));
});

await test('moderação oculta post; integrante deixa de ver, autora e moderação continuam vendo', async () => {
  await as(mod, `update public.posts set hidden_at = now() where id = $1`, [anaPost.id]);
  assert.equal((await as(bia, `select count(*)::int n from public.posts where id = $1`, [anaPost.id]))[0].n, 0);
  assert.equal((await as(ana, `select count(*)::int n from public.posts where id = $1`, [anaPost.id]))[0].n, 1);
  assert.equal((await as(mod, `select count(*)::int n from public.posts where id = $1`, [anaPost.id]))[0].n, 1);
  await denied(as(mod, `update public.posts set body = 'censura' where id = $1`, [anaPost.id]), /não altera/);
  const log = await sys(`select action from public.audit_log where target_id = $1`, [anaPost.id]);
  assert.ok(log.some((l) => l.action === 'hide'));
});

await test('projeto privado: só participantes veem projeto e publicações; a equipe só modera', async () => {
  const [pr] = await as(ana, `insert into public.projects (slug, name, category, visibility, owner_id) values ($1, 'Projeto Sigilo', 'ideia', 'private', $2) returning id`, [`sigilo-${run}`, ana.id]);
  const [post] = await as(ana, `insert into public.posts (author_id, context, project_id, body) values ($1, 'project', $2, 'interno') returning id`, [ana.id, pr.id]);
  assert.equal((await as(bia, `select count(*)::int n from public.projects where id = $1`, [pr.id]))[0].n, 0);
  assert.equal((await as(bia, `select count(*)::int n from public.posts where id = $1`, [post.id]))[0].n, 0);
  await denied(as(bia, `insert into public.posts (author_id, context, project_id, body) values ($1, 'project', $2, 'x')`, [bia.id, pr.id]));
  await as(ana, `insert into public.project_members (project_id, member_id, added_by) values ($1, $2, $3)`, [pr.id, bia.id, ana.id]);
  assert.equal((await as(bia, `select count(*)::int n from public.posts where id = $1`, [post.id]))[0].n, 1);
  await denied(as(bia, `insert into public.project_members (project_id, member_id, added_by) values ($1, $2, $3)`, [pr.id, mod.id, bia.id]));
  const n = await as(bia, `select kind from public.notifications where kind = 'project_invite'`);
  assert.equal(n.length, 1);
  // a equipe do clube não lê projeto privado nem seus posts; o feed dela não mostra nada dele
  for (const staffer of [admin, mod]) {
    assert.equal((await as(staffer, `select count(*)::int n from public.projects where id = $1`, [pr.id]))[0].n, 0);
    assert.equal((await as(staffer, `select count(*)::int n from public.posts where id = $1`, [post.id]))[0].n, 0);
    const [f] = await as(staffer, `select public.feed_page() as r`);
    assert.ok(!JSON.stringify(f.r).includes('interno'), 'post de projeto privado fora do feed da equipe');
  }
  // lista administrativa mostra só o nome; integrante comum não chama a lista
  const [lst] = await as(admin, `select public.admin_projects() as r`);
  assert.ok(lst.r.some((p) => p.id === pr.id && p.name === 'Projeto Sigilo' && !('description' in p)));
  await denied(as(bia, `select public.admin_projects()`), /permissão/);
  // denunciado, o post pode ser ocultado pela moderação sem que ela leia o projeto
  await denied(as(bia, `select public.moderate_content('post', $1, true)`, [post.id]), /permissão/);
  assert.equal((await as(mod, `select public.moderate_content('post', $1, true) as ok`, [post.id]))[0].ok, true);
  assert.equal((await as(bia, `select count(*)::int n from public.posts where id = $1`, [post.id]))[0].n, 0);
  assert.equal((await as(ana, `select count(*)::int n from public.posts where id = $1 and hidden_at is not null`, [post.id]))[0].n, 1);
  await as(mod, `select public.moderate_content('post', $1, false)`, [post.id]);
});

await test('empresa: só administradoras publicam e editam; destaque é da administração do clube', async () => {
  const [cat] = await sys(`select id from public.business_categories where slug = 'beleza'`);
  const [b] = await as(ana, `insert into public.businesses (slug, name, category_id, owner_id) values ($1, 'Ateliê Teste', $2, $3) returning id`, [`atelie-${run}`, cat.id, ana.id]);
  assert.equal((await as(ana, `select role from public.business_admins where business_id = $1`, [b.id]))[0].role, 'owner');
  await as(ana, `insert into public.posts (author_id, context, business_id, body) values ($1, 'business', $2, 'novidade')`, [ana.id, b.id]);
  await denied(as(bia, `insert into public.posts (author_id, context, business_id, body) values ($1, 'business', $2, 'x')`, [bia.id, b.id]), /administradoras/);
  assert.equal((await as(bia, `update public.businesses set name = 'Hack' where id = $1 returning id`, [b.id])).length, 0);
  await denied(as(ana, `update public.businesses set featured = true where id = $1`, [b.id]), /destaca/);
  await as(admin, `update public.businesses set featured = true where id = $1`, [b.id]);
  await denied(as(bia, `insert into public.businesses (slug, name, category_id, owner_id) values ($1, 'Falsa', $2, $3)`, [`falsa-${run}`, cat.id, ana.id]));
  // interações da empresa: só quem administra (ou a administração do clube) consulta
  const [ins] = await as(ana, `select public.business_insights($1) as r`, [b.id]);
  assert.equal(ins.r.posts_total, 1);
  assert.equal((await as(bia, `select public.business_insights($1) as r`, [b.id]))[0].r, null);
  const [list] = await as(bia, `select public.businesses_list(null, 'teste ana', null, false, 0, 10) r`);
  assert.ok(list.r.some((x) => x.id === b.id), 'busca encontra pelo nome da responsável');
});

await test('papéis: integrante não acessa admin; ninguém muda o próprio papel; só super admin cria admins', async () => {
  await denied(as(ana, `select public.admin_stats()`), /permissão/);
  const [s] = await as(mod, `select public.admin_stats() r`);
  assert.ok(s.r.members_active >= 4);
  await denied(as(ana, `update public.members set role = 'admin' where id = $1 returning id`, [ana.id]).then((r) => { if (!r.length) throw new Error('bloqueado'); }));
  const [promoted] = await as(admin, `update public.members set role = 'admin' where id = $1 returning role`, [mod.id]);
  assert.equal(promoted.role, 'admin');
  await denied(as(mod, `update public.members set role = 'admin' where id = $1`, [bia.id]), /super admin/);
  await denied(as(admin, `update public.members set role = 'member' where id = $1`, [admin.id]), /próprio/);
});

await test('afirmação do dia: estável no dia, sem repetir até esgotar a biblioteca', async () => {
  const [a1] = await as(ana, `select public.affirmation_today() r`);
  const [a2] = await as(bia, `select public.affirmation_today() r`);
  assert.equal(a1.r.id, a2.r.id);
  await as(ana, `insert into public.affirmation_favorites (member_id, affirmation_id) values ($1, $2)`, [ana.id, a1.r.id]);
  const [fav] = await as(ana, `select public.affirmations_favorites() r`);
  assert.equal(fav.r.length, 1);
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select public.ensure_affirmation(d::date) from generate_series(current_date + 1, current_date + 119, interval '1 day') d`);
    const [{ total, distintas }] = (await c.query(`select count(*)::int total, count(distinct affirmation_id)::int distintas from public.affirmation_schedule where cycle = 1`)).rows;
    assert.equal(total, distintas, 'nenhuma repetição dentro do ciclo');
    await c.query('rollback');
  } finally { c.release(); }
  const [fut] = await as(bia, `select count(*)::int n from public.affirmation_schedule where day > public.club_today()`);
  assert.equal(fut.n, 0, 'integrante não vê agenda futura');
  await denied(as(ana, `select public.ensure_affirmation(current_date + 5)`));
});

await test('storage: cada integrante só grava na própria pasta; foto privada só a dona lê', async () => {
  await as(ana, `insert into storage.objects (bucket_id, name) values ('private', $1)`, [`${ana.id}/check.webp`]);
  await denied(as(ana, `insert into storage.objects (bucket_id, name) values ('media', $1)`, [`${bia.id}/x.webp`]));
  assert.equal((await as(bia, `select count(*)::int n from storage.objects where bucket_id = 'private'`))[0].n, 0);
  await denied(as(outsider, `insert into storage.objects (bucket_id, name) values ('media', $1)`, [`${outsider.id}/x.webp`]));
});

await test('agenda: capacidade respeitada e link online só para inscritas', async () => {
  const [e] = await as(admin, `insert into public.events (title, kind, starts_at, capacity, online_url, published) values ('Encontro teste', 'online', now() + interval '2 days', 1, 'https://exemplo.com/sala', true) returning id`);
  const [d1] = await as(bia, `select public.event_detail($1) r`, [e.id]);
  assert.equal(d1.r.online_url, null);
  await as(ana, `insert into public.event_registrations (event_id, member_id) values ($1, $2)`, [e.id, ana.id]);
  await denied(as(bia, `insert into public.event_registrations (event_id, member_id) values ($1, $2)`, [e.id, bia.id]), /lotado/);
  const [d2] = await as(ana, `select public.event_detail($1) r`, [e.id]);
  assert.equal(d2.r.online_url, 'https://exemplo.com/sala');
});

await test('bloqueio: conteúdo de quem bloqueei some do feed', async () => {
  const [p] = await as(bia, `insert into public.posts (author_id, body) values ($1, 'post da bia') returning id`, [bia.id]);
  await as(ana, `insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [ana.id, bia.id]);
  const [f] = await as(ana, `select public.feed_page() r`);
  assert.ok(!f.r.some((x) => x.id === p.id));
  await as(ana, `delete from public.blocks where blocker_id = $1`, [ana.id]);
});

await test('clube do livro: votação, leitoras, cupons e o ciclo do mês', async () => {
  const yr = 2100 + Math.floor(Math.random() * 800);
  const [{ today }] = await sys(`select public.club_today()::text today`);
  // catálogo do clube só a administração; livro pessoal qualquer integrante
  await denied(as(ana, `insert into public.books (title, club, created_by) values ('Falso', true, $1)`, [ana.id]));
  const [b1] = await as(admin, `insert into public.books (title, author, club, created_by) values ('Livro A ${run}', 'Autora', true, $1) returning id`, [admin.id]);
  const [b2] = await as(admin, `insert into public.books (title, club, created_by) values ('Livro B ${run}', true, $1) returning id`, [admin.id]);
  const [b3] = await as(admin, `insert into public.books (title, club, created_by) values ('Livro C ${run}', true, $1) returning id`, [admin.id]);
  // votação aberta hoje para um mês distante
  await denied(as(ana, `insert into public.book_polls (target_month, opens_on, closes_on) values ($1, $2::date - 1, $2::date + 1)`, [`${yr}-01-01`, today]));
  const [poll] = await as(admin, `insert into public.book_polls (target_month, opens_on, closes_on, created_by) values ($1, $2::date - 1, $2::date + 1, $3) returning id`, [`${yr}-01-01`, today, admin.id]);
  await as(admin, `insert into public.book_poll_options (poll_id, book_id, position) values ($1,$2,1), ($1,$3,2), ($1,$4,3)`, [poll.id, b1.id, b2.id, b3.id]);
  await as(ana, `insert into public.book_votes (poll_id, member_id, book_id) values ($1, $2, $3)`, [poll.id, ana.id, b1.id]);
  await as(bia, `insert into public.book_votes (poll_id, member_id, book_id) values ($1, $2, $3)`, [poll.id, bia.id, b1.id]);
  await as(ana, `update public.book_votes set book_id = $2 where poll_id = $1 and member_id = $3`, [poll.id, b2.id, ana.id]);
  await as(ana, `update public.book_votes set book_id = $2 where poll_id = $1 and member_id = $3`, [poll.id, b1.id, ana.id]);
  await denied(as(bia, `insert into public.book_votes (poll_id, member_id, book_id) values ($1, $2, $3)`, [poll.id, ana.id, b2.id]));
  assert.equal((await as(bia, `select count(*)::int n from public.book_votes where poll_id = $1`, [poll.id]))[0].n, 1, 'só vê o próprio voto');
  assert.equal((await as(ana, `select public.book_poll_results($1) r`, [poll.id]))[0].r, null, 'placar fechado durante a votação');
  assert.ok((await as(admin, `select public.book_poll_results($1) r`, [poll.id]))[0].r.length === 3, 'administração acompanha');
  // fecha a votação: o mais votado vira o livro do mês e todas são avisadas
  await sys(`update public.book_polls set opens_on = $2::date - 5, closes_on = $2::date - 2 where id = $1`, [poll.id, today]);
  await denied(as(ana, `update public.book_votes set book_id = $2 where poll_id = $1 and member_id = $3 returning 1`, [poll.id, b3.id, ana.id]).then((r) => { if (!r.length) throw new Error('fechada'); }));
  await sys(`select public.queue_book_club(now())`);
  const [m] = await sys(`select id, book_id from public.book_months where month = $1`, [`${yr}-01-01`]);
  assert.equal(m.book_id, b1.id, 'vencedor vira o livro do mês');
  assert.equal((await as(ana, `select public.book_poll_results($1) r`, [poll.id]))[0].r.find((x) => x.book_id === b1.id).votes, 2);
  assert.ok((await as(bia, `select count(*)::int n from public.notifications where kind = 'book_club' and title = 'Resultado da votação'`))[0].n >= 1);
  // livro do mês futuro não aparece para integrantes
  assert.equal((await as(ana, `select count(*)::int n from public.book_months where id = $1`, [m.id]))[0].n, 0);
  await denied(as(ana, `insert into public.book_readers (month_id, member_id) values ($1, $2)`, [m.id, ana.id]));

  // mês atual: aviso do dia 1 às 9h, "Vou ler" e avisos do encontro
  const cm = (await sys(`select date_trunc('month', public.club_today())::date::text m`))[0].m;
  let [cur] = await sys(`select id from public.book_months where month = $1`, [cm]);
  if (!cur) [cur] = await sys(`insert into public.book_months (month, book_id) values ($1, $2) returning id`, [cm, b2.id]);
  await sys(`update public.book_months set announced_at = null where id = $1`, [cur.id]);
  await sys(`update public.user_preferences set notify_book_club = false where member_id = $1`, [bia.id]);
  const before = async (u) => (await as(u, `select count(*)::int n from public.notifications where kind = 'book_club' and link = '/clube-do-livro' and title like 'Livro de %'`))[0].n;
  const [a0, b0] = [await before(ana), await before(bia)];
  await sys(`select public.queue_book_club(($1::date + time '07:00') at time zone 'America/Sao_Paulo')`, [today]);
  assert.equal(await before(ana), a0, 'antes das 9h não avisa');
  await sys(`select public.queue_book_club(($1::date + time '09:05') at time zone 'America/Sao_Paulo')`, [today]);
  assert.equal(await before(ana), a0 + 1, 'aviso do livro do mês');
  assert.equal(await before(bia), b0, 'quem desligou o Clube do Livro não recebe');
  await sys(`update public.user_preferences set notify_book_club = true where member_id = $1`, [bia.id]);
  await as(ana, `insert into public.book_readers (month_id, member_id) values ($1, $2) on conflict do nothing`, [cur.id, ana.id]);
  assert.equal((await as(bia, `select count(*)::int n from public.book_readers where month_id = $1`, [cur.id]))[0].n, 0, 'lista nominal não é pública');
  const [home] = await as(bia, `select public.book_club_home() h`);
  assert.ok(home.h.current.readers >= 1, 'total de leitoras é público');
  const [ev] = await as(admin, `insert into public.events (title, kind, starts_at, published, created_by) values ('Encontro ${run}', 'presencial', now() + interval '20 hours', true, $1) returning id`, [admin.id]);
  await as(admin, `update public.book_months set meeting_event_id = $2 where id = $1`, [cur.id, ev.id]);
  assert.equal((await as(ana, `select count(*)::int n from public.notifications where kind = 'book_club' and event_id = $1`, [ev.id]))[0].n, 1, 'leitora avisada do encontro');
  assert.equal((await as(bia, `select count(*)::int n from public.notifications where kind = 'book_club' and event_id = $1`, [ev.id]))[0].n, 0, 'quem não vai ler não recebe');

  // cupom só aparece a partir da data de início
  const [cp] = await as(admin, `insert into public.book_coupons (book_id, store, code, starts_on, created_by) values ($1, 'Livraria', 'SEVEN10', $2::date + 3, $3) returning id`, [b1.id, today, admin.id]);
  assert.equal((await as(ana, `select count(*)::int n from public.book_coupons where id = $1`, [cp.id]))[0].n, 0);
  await sys(`update public.book_coupons set starts_on = $2 where id = $1`, [cp.id, today]);
  assert.equal((await as(ana, `select count(*)::int n from public.book_coupons where id = $1`, [cp.id]))[0].n, 1);
  await denied(as(ana, `insert into public.book_coupons (book_id, store, code) values ($1, 'X', 'FAKE')`, [b1.id]));
  await sys(`delete from public.book_coupons where id = $1`, [cp.id]);
});

await test('biblioteca: estante visível para todas, escrita só pela dona, estrelas de 1 a 7', async () => {
  const [bk] = await as(ana, `insert into public.books (title, author, created_by) values ('Livro pessoal ${run}', 'Alguém', $1) returning id`, [ana.id]);
  await denied(as(ana, `insert into public.library_entries (member_id, book_id, rating) values ($1, $2, 8)`, [ana.id, bk.id]));
  await denied(as(ana, `insert into public.library_entries (member_id, book_id, rating) values ($1, $2, 0)`, [ana.id, bk.id]));
  const [e] = await as(ana, `insert into public.library_entries (member_id, book_id, rating, review) values ($1, $2, 7, 'Mudou meu ano') returning id`, [ana.id, bk.id]);
  await denied(as(ana, `insert into public.library_entries (member_id, book_id, rating) values ($1, $2, 5)`, [ana.id, bk.id]), /duplicate|unique/);
  await denied(as(bia, `insert into public.library_entries (member_id, book_id, rating) values ($1, $2, 5)`, [ana.id, bk.id]));
  const [shelf] = await as(bia, `select public.library_of($1) r`, [ana.id]);
  assert.ok(shelf.r.some((x) => x.id === e.id && x.rating === 7 && x.review === 'Mudou meu ano'));
  assert.equal((await as(bia, `update public.library_entries set rating = 1 where id = $1 returning id`, [e.id])).length, 0);
  assert.equal((await as(bia, `update public.books set title = 'x' where id = $1 returning id`, [bk.id])).length, 0);
  assert.equal((await as(outsider, `select count(*)::int n from public.library_entries`))[0].n, 0);
  const [x] = await as(ana, `select public.my_export() r`);
  assert.ok(x.r.library.some((l) => l.id === e.id), 'biblioteca entra na exportação de dados');
});

await test('planner: só a dona lê, grava, move e exporta as próprias linhas', async () => {
  const [it] = await as(ana, `insert into public.planner_items (day, position, text, pillar_id) values (public.club_today(), 0, 'reunião privada', 4) returning id, owner_id`);
  assert.equal(it.owner_id, ana.id);
  for (const u of [bia, mod, admin]) {
    assert.equal((await as(u, `select count(*)::int n from public.planner_items where id = $1`, [it.id]))[0].n, 0, 'ninguém além da dona vê a linha');
    assert.equal((await as(u, `update public.planner_items set text = 'x' where id = $1 returning id`, [it.id])).length, 0);
    assert.equal((await as(u, `delete from public.planner_items where id = $1 returning id`, [it.id])).length, 0);
    await denied(as(u, `select public.planner_jump($1)`, [it.id]), /não encontrada/);
  }
  await denied(as(bia, `insert into public.planner_items (owner_id, day, text) values ($1, public.club_today(), 'intrusa')`, [ana.id]));
  const [mv] = await as(ana, `select public.planner_jump($1) id`, [it.id]);
  const [copy] = await as(ana, `select day = public.club_today() + 1 as tomorrow, text, pillar_id, moved_from from public.planner_items where id = $1`, [mv.id]);
  assert.ok(copy.tomorrow && copy.text === 'reunião privada' && copy.pillar_id === 4 && copy.moved_from === it.id);
  await as(ana, `select public.planner_jump($1)`, [it.id]);
  assert.equal((await as(ana, `select status from public.planner_items where id = $1`, [it.id]))[0].status, 'open', 'pular de novo desfaz');
  assert.equal((await as(ana, `select count(*)::int n from public.planner_items where id = $1`, [mv.id]))[0].n, 0);
  await as(ana, `insert into public.planner_pages (key, text) values ('notas:body', 'só minha')`);
  assert.equal((await as(admin, `select count(*)::int n from public.planner_pages where owner_id = $1`, [ana.id]))[0].n, 0);
  await denied(as(ana, `insert into public.planner_pages (key, text) values ('qualquer', 'x')`));
  const [x] = await as(ana, `select public.my_export() r`);
  assert.ok(x.r.planner.some((l) => l.id === it.id) && x.r.planner_pages.length >= 1, 'planner entra na exportação de dados');
});

await test('assinatura: sessões de checkout e eventos do Asaas ficam só no servidor', async () => {
  await sys(`insert into public.checkout_sessions (full_name, email, value) values ('Teste Checkout', $1, 197)`, [`checkout-${run}@teste.local`]);
  for (const u of [ana, admin]) {
    await denied(as(u, `select count(*) from public.checkout_sessions`));
    await denied(as(u, `select count(*) from public.asaas_events`));
    await denied(as(u, `select public.email_is_member('a@b.c')`));
  }
  await denied(as(null, `select count(*) from public.checkout_sessions`));
});

await test('rotinas agendadas não podem ser chamadas por integrantes', async () => {
  await denied(as(admin, `select public.expire_memberships()`));
  await denied(as(admin, `select public.queue_book_club()`));
  await denied(as(ana, `select public.queue_daily_affirmations()`));
  await denied(as(ana, `select public.notify($1, null, 'like', 't', 'b', '/')`, [bia.id]));
});

await test('exportação de dados devolve só os dados da própria integrante', async () => {
  const [x] = await as(ana, `select public.my_export() r`);
  assert.ok(x.r.check_ins.length >= 1);
  assert.ok(x.r.posts.every((p) => p.author_id === ana.id));
});

console.log(results.join('\n'));
console.log(`\n${passed}/${results.length} cenários de segurança passaram`);
await pool.end();
