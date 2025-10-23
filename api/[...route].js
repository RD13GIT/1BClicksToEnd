// api/[...route].js
import { getRedis } from '../lib/redis.js';
import { getClientId } from '../lib/id.js';
import { requireAdminUser, isTrueish } from '../lib/adminUser.js';

async function readJSON(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}
function noStore(res) { res.setHeader('Cache-Control', 'no-store'); }

export default async function handler(req, res) {
  // Robust base URL for Vercel
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';

  let route = '';
  try {
    const url = new URL(req.url, `${proto}://${host}`);
    route = decodeURIComponent(url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+|\/+$/g, '');
  } catch (e) {
    console.error('URL parse error:', e);
    return res.status(500).json({ error: 'Bad URL', detail: String(e) });
  }

  const [seg1 = '', seg2 = ''] = route.split('/');

  try {
    // default: GET /api -> simple health
    if (!seg1) return res.status(200).json({ ok: true, route: '' });

    // ping
    if (seg1 === 'ping') {
      const r = await getRedis();
      const pong = await r.ping();
      return res.status(200).json({ ok: true, pong, route });
    }

    // me
    if (seg1 === 'me') {
      const cid = getClientId(req, res);
      const r = await getRedis();
      const [name, a1, a2, b1, b2] = await Promise.all([
        r.hGet(`user:${cid}`, 'name'),
        r.hGet(`user:${cid}`, 'Admin'),
        r.hGet(`user:${cid}`, 'admin'),
        r.hGet(`user:${cid}`, 'Banned'),
        r.hGet(`user:${cid}`, 'banned')
      ]);
      const admin = isTrueish(a1 ?? a2);
      const banned = isTrueish(b1 ?? b2);
      noStore(res);
      return res.status(200).json({ id: cid, name: name || '', admin, banned });
    }

    // name
    if (seg1 === 'name') {
      const cid = getClientId(req, res);
      const r = await getRedis();

      if (req.method === 'GET') {
        const name = await r.hGet(`user:${cid}`, 'name');
        noStore(res);
        return res.status(200).json({ id: cid, name: name || '' });
      }
      if (req.method === 'POST') {
        const body = await readJSON(req);
        let name = (body?.name ?? '').toString().trim().replace(/\s+/g, ' ');
        if (name.length < 2 || name.length > 32) return res.status(400).json({ error: 'Name must be 2–32 characters' });
        name = name.replace(/[^\p{L}\p{N} _.-]/gu, '');
        await r.hSet(`user:${cid}`, { name });
        noStore(res);
        return res.status(200).json({ ok: true, id: cid, name });
      }
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).send('Method Not Allowed');
    }

    // count
    if (seg1 === 'count') {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).send('Method Not Allowed'); }
      getClientId(req, res);
      const r = await getRedis();
      const val = await r.get('global_count');
      noStore(res);
      return res.status(200).json({ count: Number(val) || 0 });
    }

    // increment
    if (seg1 === 'increment') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).send('Method Not Allowed'); }
      const cid = getClientId(req, res);
      const r = await getRedis();
      const [b1, b2] = await Promise.all([r.hGet(`user:${cid}`, 'Banned'), r.hGet(`user:${cid}`, 'banned')]);
      if (isTrueish(b1 ?? b2)) return res.status(403).json({ error: 'Banned' });
      const [count] = await Promise.all([
        r.incr('global_count'),
        r.zIncrBy('leaderboard', 1, cid),
        r.hSetNX(`user:${cid}`, 'name', 'Anonymous')
      ]);
      noStore(res);
      return res.status(200).json({ count });
    }

    // leaderboard
    if (seg1 === 'leaderboard') {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).send('Method Not Allowed'); }
      getClientId(req, res);
      const r = await getRedis();
      const raw = await r.zRangeWithScores('leaderboard', 0, 49, { REV: true });
      const [names, bans1, bans2] = await Promise.all([
        Promise.all(raw.map(({ value: id }) => r.hGet(`user:${id}`, 'name'))),
        Promise.all(raw.map(({ value: id }) => r.hGet(`user:${id}`, 'Banned'))),
        Promise.all(raw.map(({ value: id }) => r.hGet(`user:${id}`, 'banned')))
      ]);
      const leaders = [];
      for (let i = 0; i < raw.length && leaders.length < 10; i++) {
        const id = raw[i].value;
        const banned = isTrueish(bans1[i] ?? bans2[i]);
        if (!banned) leaders.push({ id, name: names[i] || 'Anonymous', count: Number(raw[i].score) || 0 });
      }
      noStore(res);
      return res.status(200).json({ leaders });
    }

    // admin suite
    if (seg1 === 'admin') {
      const auth = await requireAdminUser(req, res);
      if (!auth.ok) return;

      if (seg2 === 'stats') {
        if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).send('Method Not Allowed'); }
        const r = await getRedis();
        const [gc, total] = await Promise.all([r.get('global_count'), r.zCard('leaderboard')]);
        noStore(res);
        return res.status(200).json({ global_count: Number(gc) || 0, leaderboard_size: Number(total) || 0 });
      }

      if (seg2 === 'set-count') {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).send('Method Not Allowed'); }
        const body = await readJSON(req);
        const value = Math.floor(Number(body.value));
        if (!Number.isFinite(value) || value < 0 || value > 1e15) return res.status(400).json({ error: 'Invalid value' });
        const r = await getRedis();
        await r.set('global_count', String(value));
        return res.status(200).json({ ok: true, value });
      }

      if (seg2 === 'add-count') {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).send('Method Not Allowed'); }
        const body = await readJSON(req);
        const delta = Math.floor(Number(body.delta));
        if (!Number.isFinite(delta) || delta <= 0) return res.status(400).json({ error: 'delta must be a positive integer' });
        const r = await getRedis();
        const count = await r.incrBy('global_count', delta);
        return res.status(200).json({ ok: true, count });
      }

      if (seg2 === 'user-delta') {
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

      if (seg2 === 'ban') {
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

      if (seg2 === 'admin') {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).send('Method Not Allowed'); }
        const body = await readJSON(req);
        const id = (body?.id || '').trim();
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const makeAdmin = isTrueish(body?.admin);
        const r = await getRedis();
        await r.hSet(`user:${id}`, { Admin: makeAdmin ? 'true' : 'false', admin: makeAdmin ? 'true' : 'false' });
        return res.status(200).json({ ok: true, id, admin: makeAdmin });
      }

      return res.status(404).json({ error: 'Not Found', route });
    }

    return res.status(404).json({ error: 'Not Found', route });
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: e?.message || 'Internal Error', route });
  }
}
