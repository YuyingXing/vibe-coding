/**
 * Photography Portfolio — Cloudflare Worker
 * Mirrors the /api/* routes of server.js for deployment on Cloudflare.
 * - Static site (public/) is served by the ASSETS binding
 * - Images are stored in R2 at <collection>/<filename>, served from /uploads/...
 * - Metadata lives in R2 as db.json (seeded from data/db.json on first run)
 * - Login tokens are HMAC-signed, so they survive across Worker instances
 */
import seedDB from '../data/db.json';

const DB_KEY = 'db.json';
const COLLECTIONS = ['works', 'inspiration'];
const EDITABLE_FIELDS = ['title', 'caption', 'location', 'year'];
const IMAGE_TYPE = /^image\/(jpeg|png|webp|gif|avif)$/;
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_FILES = 50;
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;

/* ---------------- helpers ---------------- */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const password = (env) => env.ADMIN_PASSWORD || 'hikari';

/* ---------------- data store ---------------- */

async function readDB(env) {
  const obj = await env.BUCKET.get(DB_KEY);
  const db = obj ? await obj.json() : structuredClone(seedDB);
  for (const c of COLLECTIONS) if (!Array.isArray(db[c])) db[c] = [];
  if (!obj) await writeDB(env, db);
  return db;
}

function writeDB(env, db) {
  return env.BUCKET.put(DB_KEY, JSON.stringify(db, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

/* ---------------- auth (signed token) ---------------- */

async function sign(env, payload) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function createToken(env) {
  const exp = String(Date.now() + TOKEN_TTL);
  return `${exp}.${await sign(env, exp)}`;
}

async function requireAuth(request, env) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [exp, sig] = token.split('.');
  if (exp && sig && Number(exp) > Date.now() && sig === (await sign(env, exp))) return;
  throw new HttpError(401, '未登录或登录已过期');
}

/* ---------------- routes ---------------- */

async function handleApi(request, env, parts) {
  const method = request.method;
  const [collection, id] = parts;

  if (collection === 'login' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (body.password !== password(env)) throw new HttpError(401, '密码错误');
    return json({ token: await createToken(env) });
  }

  if (collection === 'session' && method === 'GET') {
    await requireAuth(request, env);
    return json({ ok: true });
  }

  if (!COLLECTIONS.includes(collection)) throw new HttpError(404, 'Unknown collection');

  if (!id && method === 'GET') {
    return json((await readDB(env))[collection]);
  }

  await requireAuth(request, env);

  if (!id && method === 'POST') {
    const form = await request.formData();
    const files = form.getAll('images').filter((f) => f instanceof File && IMAGE_TYPE.test(f.type));
    if (!files.length) throw new HttpError(400, '请选择图片文件（jpg / png / webp / gif / avif）');
    if (files.length > MAX_FILES) throw new HttpError(400, `一次最多上传 ${MAX_FILES} 张`);
    if (files.some((f) => f.size > MAX_FILE_SIZE)) throw new HttpError(400, '单张图片不能超过 30MB');

    const field = (k) => String(form.get(k) || '').trim();
    const now = Date.now();
    const added = [];
    for (const [i, f] of files.entries()) {
      const dot = f.name.lastIndexOf('.');
      const ext = dot > 0 ? f.name.slice(dot).toLowerCase() : '.jpg';
      const base = dot > 0 ? f.name.slice(0, dot) : f.name;
      const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const filename = `${now + i}-${rand}${ext}`;
      await env.BUCKET.put(`${collection}/${filename}`, f.stream(), { httpMetadata: { contentType: f.type } });
      added.push({
        id: crypto.randomUUID(),
        src: `/uploads/${collection}/${filename}`,
        title: field('title') || (collection === 'works' ? base : ''),
        caption: field('caption'),
        location: field('location'),
        year: field('year'),
        createdAt: now + i,
      });
    }
    const db = await readDB(env);
    // newest first
    db[collection].unshift(...added);
    await writeDB(env, db);
    return json(added, 201);
  }

  if (id === 'order' && method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const db = await readDB(env);
    const list = db[collection];
    const byId = new Map(list.map((x) => [x.id, x]));
    const ordered = ids.map((x) => byId.get(x)).filter(Boolean);
    const rest = list.filter((x) => !ids.includes(x.id));
    db[collection] = [...ordered, ...rest];
    await writeDB(env, db);
    return json({ ok: true });
  }

  if (id && method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    const db = await readDB(env);
    const item = db[collection].find((x) => x.id === id);
    if (!item) throw new HttpError(404, 'Not found');
    for (const k of EDITABLE_FIELDS) {
      if (typeof body[k] === 'string') item[k] = body[k].trim();
    }
    await writeDB(env, db);
    return json(item);
  }

  if (id && method === 'DELETE') {
    const db = await readDB(env);
    const list = db[collection];
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) throw new HttpError(404, 'Not found');
    const [item] = list.splice(idx, 1);
    if (item.src.startsWith('/uploads/')) await env.BUCKET.delete(item.src.slice('/uploads/'.length));
    await writeDB(env, db);
    return json({ ok: true });
  }

  throw new HttpError(404, 'Not found');
}

async function handleUpload(request, env, key) {
  const [collection] = key.split('/');
  if (!COLLECTIONS.includes(collection)) return new Response('Not found', { status: 404 });
  const obj = await env.BUCKET.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=604800');
  return new Response(obj.body, { headers });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    try {
      if (pathname.startsWith('/api/')) {
        return await handleApi(request, env, pathname.slice('/api/'.length).split('/').map(decodeURIComponent));
      }
      if (pathname.startsWith('/uploads/')) {
        return await handleUpload(request, env, decodeURIComponent(pathname.slice('/uploads/'.length)));
      }
      return env.ASSETS.fetch(request);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      return json({ error: err.message || 'Server error' }, 500);
    }
  },
};
