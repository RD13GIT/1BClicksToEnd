import { getRedis } from '../../lib/redis.js';
import { requireAdminUser, isTrueish } from '../../lib/adminUser.js';

export const config = { runtime: 'nodejs18.x', memory: 1024, maxDuration: 10 };

async function readJSON(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const url = new URL(req.url, `${proto}://${host}`);
  const route = decodeURIComponent(url.pathname.replace(/^\/api\/admin\/?/, '')).replace(/^\/+|\/+$/g, '');
  const seg = route.split('/')[0] || '';

  try {
    const auth = await requireAdminUser(req, res);
    if (!auth.ok) return;

    if (seg === 'stats') {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).send('Method Not Allowed'); }
      const r = await getRedis();
      const [gc, total] = await Promise.all([r.get('global_count'), r.zCard('leaderboard')]);
      return res.status(200).json({ global_count: Number(gc) || 0, leaderboard_size: Number(total) || 0 });
    }

    if (seg === 'set-count') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).send('Method Not Allowed'); }
      const body = await readJSON(req);
      const value = Math.floor(Number(body.value));
      if (!Number.isFinite(value) || value < 0 || value > 1e15) return res.status(400).json({ error: 'Invalid value' });
      const r = await getRedis();
      await r.set('global_count', String(value));
      return res.status(200).json({ ok: true, value });
    }

    if (seg === 'add-count') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).send('Method Not Allowed'); }
      const body = await readJSON(req);
      const delta = Math.floor(Number(body.delta));
      if (!Number.isFinite(delta) || delta <= 0) return res.status(400).json({ error: 'delta must be a positive integer' });
      const r = await getRedis();
      const count = await r.incrBy('global_count', delta);
      return res.status(200).json({ ok: true, count });
    }

    if (seg === 'user-delta') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).send('Method Not Allowed'); }
      const body = await readJSON(req);
      const id = (body?.id || '').trim();
      const delta = Math.floor(Number(body?.delta));
      if (!id) return res.status(400).json({ error: 'Missing id' });
      if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'delta must be a non-zero integer' });
      const r = await getRedis();
      let newScore = await r.zIncrBy('leaderboard', delta, id);
      if (newScore < 0) { await r.zAdd('leaderboard', [{ value: id, score: 0 }]); newScore = 0; }
      return res.status(200).json({ ok: true, id, count: Number(newScore) });
    }

    if (seg === 'ban') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).send('Method Not Allowed'); }
      const body = await readJSON(req);
      const id = (body?.id || '').trim();
      const banned = !!body?.banned;
      const purge = !!body?.purge;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const r = await getRedis();
      await r.hSet(`user:${id}`, { Banned: banned ? 'true' : 'false' });
      if (purge) await r.zRem('leaderboard', id);
      return res.status(200).json({ ok: true, id, banned, purged: purge });
    }

    if (seg === 'admin') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).send('Method Not Allowed'); }
      const body = await readJSON(req);
      const id = (body?.id || '').trim();
      const makeAdmin = isTrueish(body?.admin);
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const r = await getRedis();
      await r.hSet(`user:${id}`, { Admin: makeAdmin ? 'true' : 'false', admin: makeAdmin ? 'true' : 'false' });
      return res.status(200).json({ ok: true, id, admin: makeAdmin });
    }

    return res.status(404).json({ error: 'Unknown admin route', route });
  } catch (e) {
    console.error('ADMIN API error:', e);
    return res.status(500).json({ error: e?.message || 'Internal Error', route });
  }
}
