// Ambiente LOCAL de testes do THE SEVEN CLUB.
// Sobe um Postgres real (embedded-postgres), aplica as migrações de supabase/migrations
// e emula o subconjunto das APIs do Supabase que o app usa (Auth, REST, Storage).
// Toda leitura/escrita roda no Postgres com o papel e o JWT da integrante, então as
// regras de RLS testadas aqui são as mesmas de produção. Não é usado em produção.

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = process.env.LOCAL_PG_DIR || path.join(root, 'dev/.local/pgdata');
const filesDir = path.join(root, 'dev/.local/storage');
const PORT = Number(process.env.LOCAL_SUPABASE_PORT || 54321);
const PG_PORT = Number(process.env.LOCAL_PG_PORT || 54329);
export const JWT_SECRET = 'local-dev-secret-not-for-production-use-0123456789';

// ---------------------------------------------------------------- JWT HS256
const b64u = (buf) => Buffer.from(buf).toString('base64url');
export function signJwt(payload) {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
function verifyJwt(token) {
  if (!token) return null;
  const [h, b, s] = token.split('.');
  if (!h || !b || !s) return null;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
  if (sig.length !== s.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(s))) return null;
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}
const far = 4102444800; // chaves locais fixas (expiram em 2100)
export const ANON_KEY = signJwt({ role: 'anon', iss: 'supabase-local', exp: far });
export const SERVICE_KEY = signJwt({ role: 'service_role', iss: 'supabase-local', exp: far });

// ---------------------------------------------------------------- Postgres
const fresh = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
const pgServer = new EmbeddedPostgres({
  databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: true,
  onLog: () => {}, onError: (e) => console.error(String(e)),
});
if (fresh) await pgServer.initialise();
await pgServer.start();
if (fresh) await pgServer.createDatabase('seven');

const pool = new pg.Pool({ host: '127.0.0.1', port: PG_PORT, user: 'postgres', password: 'postgres', database: 'seven', max: 10 });
pg.types.setTypeParser(1082, (v) => v); // date como texto

if (fresh) {
  const client = await pool.connect();
  try {
    await client.query(fs.readFileSync(path.join(root, 'dev/local-supabase/bootstrap.sql'), 'utf8'));
    const migDir = path.join(root, 'supabase/migrations');
    for (const f of fs.readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) {
      await client.query(fs.readFileSync(path.join(migDir, f), 'utf8'));
      console.log('migração aplicada:', f);
    }
  } finally {
    client.release();
  }
}
fs.mkdirSync(filesDir, { recursive: true });

// Executa SQL com o papel e as claims de quem chamou (como o PostgREST faz)
async function asRole(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const role = claims?.role === 'service_role' ? 'service_role' : claims?.role === 'authenticated' ? 'authenticated' : 'anon';
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims || { role: 'anon' })]);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------- HTTP helpers
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info, x-upsert, prefer, accept-profile, content-profile, range, x-supabase-api-version, cache-control',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range, x-total-count',
};
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { ...CORS, ...(isBuf ? {} : { 'content-type': 'application/json' }), ...headers });
  res.end(isBuf ? body : body === undefined ? '' : JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
function claimsFrom(req) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return verifyJwt(bearer) || verifyJwt(req.headers.apikey) || null;
}
function pgError(res, e) {
  const code = e.code || 'XX000';
  const status = code === '42501' ? 403 : code === '23505' ? 409 : code === 'PGRST116' ? 406 : code.startsWith('22') || code.startsWith('23') || code === 'P0001' ? 400 : 400;
  if (process.env.LOCAL_DEBUG) console.error('[pg]', code, e.message);
  send(res, status, { code, message: e.message, details: e.detail || null, hint: e.hint || null });
}

// ---------------------------------------------------------------- Auth (subconjunto do GoTrue)
const refreshTokens = new Map(); // token -> user id
const recoveryTokens = new Map(); // token_hash -> user id

function userJson(u) {
  return {
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    email_confirmed_at: u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.raw_user_meta_data || {},
    identities: [], created_at: u.created_at, updated_at: u.updated_at, is_anonymous: false,
  };
}
function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = signJwt({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, session_id: crypto.randomUUID() });
  const refresh_token = crypto.randomBytes(24).toString('hex');
  refreshTokens.set(refresh_token, u.id);
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token, user: userJson(u) };
}
const authErr = (res, status, code, msg) => send(res, status, { code: status, error_code: code, msg, error: code, error_description: msg });

async function handleAuth(req, res, url, sub) {
  const claims = claimsFrom(req);
  const body = ['POST', 'PUT'].includes(req.method) ? JSON.parse((await readBody(req)).toString() || '{}') : {};
  const q = (text, vals) => pool.query(text, vals);

  if (sub === 'token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const { rows } = await q(`select * from auth.users where email = lower($1) and encrypted_password = extensions.crypt($2, encrypted_password)`, [body.email || '', body.password || '']);
      if (!rows[0]) return authErr(res, 400, 'invalid_credentials', 'Invalid login credentials');
      await q('update auth.users set last_sign_in_at = now() where id = $1', [rows[0].id]);
      return send(res, 200, session(rows[0]));
    }
    if (grant === 'refresh_token') {
      const uid = refreshTokens.get(body.refresh_token);
      if (!uid) return authErr(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
      refreshTokens.delete(body.refresh_token);
      const { rows } = await q('select * from auth.users where id = $1', [uid]);
      if (!rows[0]) return authErr(res, 400, 'user_not_found', 'User not found');
      return send(res, 200, session(rows[0]));
    }
    return authErr(res, 400, 'unsupported_grant_type', 'Unsupported grant');
  }

  if (sub === 'user') {
    if (claims?.role !== 'authenticated') return authErr(res, 401, 'no_authorization', 'Invalid JWT');
    if (req.method === 'PUT') {
      if (body.password) await q(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), updated_at = now() where id = $1`, [claims.sub, body.password]);
      if (body.data) await q(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb where id = $1`, [claims.sub, JSON.stringify(body.data)]);
    }
    const { rows } = await q('select * from auth.users where id = $1', [claims.sub]);
    if (!rows[0]) return authErr(res, 404, 'user_not_found', 'User not found');
    return send(res, 200, userJson(rows[0]));
  }

  if (sub === 'logout') return send(res, 204);

  if (sub === 'recover' && req.method === 'POST') {
    const { rows } = await q('select id from auth.users where email = lower($1)', [body.email || '']);
    if (rows[0]) {
      const th = crypto.randomBytes(16).toString('hex');
      recoveryTokens.set(th, rows[0].id);
      const base = (body.redirect_to || url.searchParams.get('redirect_to') || 'http://localhost:3000/auth/confirm').split('?')[0];
      console.log(`\n[e-mail local] Recuperação de senha para ${body.email}: ${base}?token_hash=${th}&type=recovery\n`);
    }
    return send(res, 200, {});
  }

  if (sub === 'verify' && req.method === 'POST') {
    const uid = recoveryTokens.get(body.token_hash);
    if (!uid) return authErr(res, 403, 'otp_expired', 'Token has expired or is invalid');
    recoveryTokens.delete(body.token_hash);
    const { rows } = await q('select * from auth.users where id = $1', [uid]);
    return send(res, 200, session(rows[0]));
  }

  if (sub.startsWith('admin/users')) {
    if (claims?.role !== 'service_role') return authErr(res, 403, 'not_admin', 'User not allowed');
    const id = sub.split('/')[2];
    if (req.method === 'POST' && !id) {
      try {
        const { rows } = await q(
          `insert into auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at)
           values (lower($1), extensions.crypt($2, extensions.gen_salt('bf')), $3::jsonb, case when $4 then now() end) returning *`,
          [body.email, body.password, JSON.stringify(body.user_metadata || {}), !!body.email_confirm]);
        return send(res, 200, userJson(rows[0]));
      } catch (e) {
        if (e.code === '23505') return authErr(res, 422, 'email_exists', 'A user with this email address has already been registered');
        throw e;
      }
    }
    if (req.method === 'DELETE' && id) {
      await q('delete from auth.users where id = $1', [id]);
      return send(res, 200, {});
    }
    if (req.method === 'GET' && id) {
      const { rows } = await q('select * from auth.users where id = $1', [id]);
      return rows[0] ? send(res, 200, userJson(rows[0])) : authErr(res, 404, 'user_not_found', 'User not found');
    }
  }

  if (sub === 'settings') return send(res, 200, { external: { email: true }, disable_signup: true });
  return authErr(res, 404, 'not_found', `auth endpoint ${sub} não emulado`);
}

// ---------------------------------------------------------------- REST (subconjunto do PostgREST)
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`identificador inválido: ${s}`), { code: '42602' });
  return `"${s}"`;
};
function parseFilters(params, vals) {
  const where = [];
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    const m = raw.match(/^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.*)$/s);
    if (!m) throw Object.assign(new Error(`filtro não suportado: ${key}=${raw}`), { code: 'PGRST100' });
    const [, not, op, v] = m;
    const col = ident(key);
    let clause;
    if (op === 'is') clause = `${col} is ${v === 'null' ? 'null' : v === 'true' ? 'true' : 'false'}`;
    else if (op === 'in') {
      const items = [];
      const inner = v.replace(/^\(|\)$/g, '');
      let cur = '', quoted = false;
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (quoted) {
          if (ch === '\\') { cur += inner[++i]; continue; }
          if (ch === '"') { quoted = false; continue; }
          cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { items.push(cur); cur = ''; }
        else cur += ch;
      }
      items.push(cur);
      vals.push(items);
      clause = `${col}::text = any($${vals.length}::text[])`;
    } else {
      const sym = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }[op];
      vals.push(op.endsWith('like') ? v.replace(/\*/g, '%') : v);
      clause = `${col}::text ${sym} $${vals.length}::text`;
      if (['gt', 'gte', 'lt', 'lte'].includes(op)) clause = `${col} ${sym} $${vals.length}`;
    }
    where.push(not ? `not (${clause})` : clause);
  }
  return where.length ? ` where ${where.join(' and ')}` : '';
}
function selectList(sel) {
  if (!sel || sel === '*') return '*';
  return sel.split(',').map((c) => c.trim()).filter(Boolean).map((c) => {
    if (c.includes('(')) throw Object.assign(new Error('embeds não são emulados localmente'), { code: 'PGRST100' });
    return ident(c);
  }).join(', ');
}

const typeCache = new Map();
async function jsonCols(table) {
  if (!typeCache.has(table)) {
    const { rows } = await pool.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 and data_type in ('json', 'jsonb')`, [table]);
    typeCache.set(table, new Set(rows.map((r) => r.column_name)));
  }
  return typeCache.get(table);
}
// PostgREST envia JSON tipado; aqui convertemos colunas json/jsonb e objetos para texto JSON
const encode = (jc, col, v) => (v === null || v === undefined ? null : jc.has(col) || (typeof v === 'object' && !Array.isArray(v)) ? JSON.stringify(v) : v);

async function handleRest(req, res, url, sub) {
  const claims = claimsFrom(req);
  const prefer = req.headers.prefer || '';
  const single = (req.headers.accept || '').includes('vnd.pgrst.object');
  const raw = await readBody(req);

  if (sub.startsWith('rpc/')) {
    const fn = sub.slice(4);
    const args = raw.length ? JSON.parse(raw.toString()) : Object.fromEntries(url.searchParams);
    const keys = Object.keys(args);
    const vals = keys.map((k) => (args[k] !== null && typeof args[k] === 'object' && !Array.isArray(args[k]) ? JSON.stringify(args[k]) : args[k]));
    const sql = `select public.${ident(fn)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')}) as r`;
    const rows = await asRole(claims, (c) => c.query(sql, vals).then((r) => r.rows));
    return send(res, 200, rows[0]?.r ?? null);
  }

  const table = `public.${ident(sub)}`;
  const vals = [];
  const where = parseFilters(url.searchParams, vals);
  const returning = prefer.includes('return=representation') ? ` returning ${selectList(url.searchParams.get('select'))}` : '';
  let sql;

  if (req.method === 'GET' || req.method === 'HEAD') {
    sql = `select ${selectList(url.searchParams.get('select'))} from ${table}${where}`;
    const order = url.searchParams.get('order');
    if (order) {
      sql += ' order by ' + order.split(',').map((o) => {
        const [col, dir, nulls] = o.split('.');
        return `${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullslast' ? ' nulls last' : nulls === 'nullsfirst' ? ' nulls first' : ''}`;
      }).join(', ');
    }
    if (url.searchParams.get('limit')) sql += ` limit ${Number(url.searchParams.get('limit'))}`;
    if (url.searchParams.get('offset')) sql += ` offset ${Number(url.searchParams.get('offset'))}`;
  } else if (req.method === 'POST') {
    const body = JSON.parse(raw.toString() || '{}');
    const rows = Array.isArray(body) ? body : [body];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const jc = await jsonCols(sub);
    const tuples = rows.map((r) => `(${cols.map((c) => { vals.push(encode(jc, c, r[c])); return `$${vals.length}`; }).join(', ')})`);
    sql = `insert into ${table} (${cols.map(ident).join(', ')}) values ${tuples.join(', ')}`;
    const conflict = url.searchParams.get('on_conflict');
    if (prefer.includes('resolution=merge-duplicates')) {
      const target = conflict ? conflict.split(',').map(ident).join(', ') : null;
      sql += target ? ` on conflict (${target}) do update set ${cols.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ')}` : ' on conflict do nothing';
    } else if (prefer.includes('resolution=ignore-duplicates')) sql += ' on conflict do nothing';
    sql += returning;
  } else if (req.method === 'PATCH') {
    const body = JSON.parse(raw.toString() || '{}');
    const jc = await jsonCols(sub);
    const sets = Object.keys(body).map((c) => { vals.push(encode(jc, c, body[c])); return `${ident(c)} = $${vals.length}`; });
    if (!where) throw Object.assign(new Error('UPDATE sem filtro bloqueado'), { code: '21000' });
    sql = `update ${table} set ${sets.join(', ')}${where}${returning}`;
  } else if (req.method === 'DELETE') {
    if (!where) throw Object.assign(new Error('DELETE sem filtro bloqueado'), { code: '21000' });
    sql = `delete from ${table}${where}${returning}`;
  } else return send(res, 405, { message: 'método não suportado' });

  const rows = await asRole(claims, (c) => c.query(sql, vals).then((r) => r.rows));
  if (req.method !== 'GET' && !returning) return send(res, prefer.includes('return=minimal') || !returning ? 201 : 200, undefined);
  if (single) {
    if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
    return send(res, 200, rows[0]);
  }
  return send(res, 200, rows, { 'content-range': `0-${Math.max(rows.length - 1, 0)}/*` });
}

// ---------------------------------------------------------------- Storage (subconjunto)
const fileOf = (bucket, name) => path.join(filesDir, bucket, ...name.split('/').map((p) => p.replace(/\.\./g, '')));
const mimeOf = (name) => ({ webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[name.split('.').pop().toLowerCase()] || 'application/octet-stream');
const stErr = (res, status, error, message) => send(res, status, { statusCode: String(status), error, message });

async function handleStorage(req, res, url, sub) {
  const claims = claimsFrom(req);
  const parts = sub.split('/').map(decodeURIComponent);
  if (parts[0] !== 'object') return stErr(res, 404, 'not_found', `storage endpoint ${sub} não emulado`);

  // leitura pública
  if (parts[1] === 'public' && req.method === 'GET') {
    const [bucket, ...rest] = parts.slice(2);
    const { rows } = await pool.query('select public from storage.buckets where id = $1', [bucket]);
    if (!rows[0]?.public) return stErr(res, 400, 'not_public', 'Bucket not public');
    const f = fileOf(bucket, rest.join('/'));
    if (!fs.existsSync(f)) return stErr(res, 404, 'not_found', 'Object not found');
    return send(res, 200, fs.readFileSync(f), { 'content-type': mimeOf(f), 'cache-control': 'public, max-age=31536000, immutable' });
  }

  // URL assinada
  if (parts[1] === 'sign') {
    const [bucket, ...rest] = parts.slice(2);
    if (req.method === 'GET') {
      const t = verifyJwt(url.searchParams.get('token'));
      const name = rest.join('/');
      if (!t || t.url !== `${bucket}/${name}`) return stErr(res, 400, 'invalid_signature', 'Invalid signature');
      const f = fileOf(bucket, name);
      if (!fs.existsSync(f)) return stErr(res, 404, 'not_found', 'Object not found');
      return send(res, 200, fs.readFileSync(f), { 'content-type': mimeOf(f), 'cache-control': 'private, max-age=600' });
    }
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    const names = rest.length ? [rest.join('/')] : body.paths || [];
    const visible = await asRole(claims, (c) => c.query('select name from storage.objects where bucket_id = $1 and name = any($2)', [bucket, names]).then((r) => new Set(r.rows.map((x) => x.name))));
    const exp = Math.floor(Date.now() / 1000) + Number(body.expiresIn || 600);
    const make = (n) => `/object/sign/${bucket}/${n.split('/').map(encodeURIComponent).join('/')}?token=${signJwt({ url: `${bucket}/${n}`, exp })}`;
    if (rest.length) return visible.has(names[0]) ? send(res, 200, { signedURL: make(names[0]) }) : stErr(res, 400, 'not_found', 'Object not found');
    return send(res, 200, names.map((n) => ({ path: n, signedURL: visible.has(n) ? make(n) : null, error: visible.has(n) ? null : 'Either the object does not exist or you do not have access to it' })));
  }

  // download autenticado
  if (req.method === 'GET') {
    const isAuthPath = parts[1] === 'authenticated';
    const [bucket, ...rest] = parts.slice(isAuthPath ? 2 : 1);
    const name = rest.join('/');
    const ok = await asRole(claims, (c) => c.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [bucket, name]).then((r) => r.rowCount > 0));
    if (!ok) return stErr(res, 400, 'not_found', 'Object not found');
    return send(res, 200, fs.readFileSync(fileOf(bucket, name)), { 'content-type': mimeOf(name) });
  }

  // remoção em lote
  if (req.method === 'DELETE') {
    const bucket = parts[1];
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    const removed = await asRole(claims, (c) => c.query('delete from storage.objects where bucket_id = $1 and name = any($2) returning name', [bucket, body.prefixes || []]).then((r) => r.rows));
    for (const r of removed) fs.rmSync(fileOf(bucket, r.name), { force: true });
    return send(res, 200, removed.map((r) => ({ name: r.name, bucket_id: bucket })));
  }

  // upload
  if (req.method === 'POST' || req.method === 'PUT') {
    const [bucket, ...rest] = parts.slice(1);
    const name = rest.join('/');
    const raw = await readBody(req);
    let bytes = raw;
    let type = req.headers['content-type'] || mimeOf(name);
    if (type.startsWith('multipart/form-data')) {
      const form = await new Response(raw, { headers: { 'content-type': type } }).formData();
      const file = [...form.values()].find((v) => typeof v === 'object');
      bytes = Buffer.from(await file.arrayBuffer());
      type = file.type || mimeOf(name);
    }
    const { rows: [b] } = await pool.query('select * from storage.buckets where id = $1', [bucket]);
    if (!b) return stErr(res, 404, 'bucket_not_found', 'Bucket not found');
    if (b.file_size_limit && bytes.length > Number(b.file_size_limit)) return stErr(res, 413, 'payload_too_large', 'The object exceeded the maximum allowed size');
    if (b.allowed_mime_types && !b.allowed_mime_types.includes(type)) return stErr(res, 415, 'invalid_mime_type', `mime type ${type} is not supported`);
    const upsert = req.headers['x-upsert'] === 'true';
    try {
      await asRole(claims, (c) => c.query(
        `insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3)` + (upsert ? ' on conflict (bucket_id, name) do update set metadata = excluded.metadata' : ''),
        [bucket, name, JSON.stringify({ mimetype: type, size: bytes.length })]));
    } catch (e) {
      if (e.code === '42501') return stErr(res, 403, 'Unauthorized', 'new row violates row-level security policy');
      if (e.code === '23505') return stErr(res, 409, 'Duplicate', 'The resource already exists');
      throw e;
    }
    const f = fileOf(bucket, name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, bytes);
    return send(res, 200, { Key: `${bucket}/${name}`, Id: crypto.randomUUID() });
  }
  return stErr(res, 405, 'method_not_allowed', 'Method not allowed');
}

// ---------------------------------------------------------------- servidor
http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const m = url.pathname.match(/^\/(auth|rest|storage)\/v1\/?(.*)$/);
  try {
    if (!m) return send(res, 404, { message: 'not found' });
    if (m[1] === 'auth') return await handleAuth(req, res, url, m[2]);
    if (m[1] === 'rest') return await handleRest(req, res, url, m[2]);
    return await handleStorage(req, res, url, m[2]);
  } catch (e) {
    return pgError(res, e);
  }
}).listen(PORT, () => {
  console.log(`\nSupabase local pronto em http://127.0.0.1:${PORT}  (Postgres em 127.0.0.1:${PG_PORT}, banco "seven")`);
  console.log(`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${PORT}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}\n`);
  if (process.env.LOCAL_KEYS_FILE) {
    fs.writeFileSync(process.env.LOCAL_KEYS_FILE, `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${PORT}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}\n`);
  }
});

const stop = async () => { await pool.end().catch(() => {}); await pgServer.stop().catch(() => {}); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
