// api/[...route].js
import { getRedis } from '../lib/redis.js';
import { getClientId } from '../lib/id.js';
import { isTrueish } from '../lib/adminUser.js';

export const config = { runtime: 'nodejs' };

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
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const url = new URL(req.url, `${proto}://${host}`);
  const route = decodeURIComponent(url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+|\/+$/g, '');
  const [seg1 = ''] = route.split('/');

  try {
    if (!seg1) return res.status(200).json({ ok: true });

    if (seg1 === 'ping') {
      const r = await getRedis();
      const pong = await r.ping();
      return res.status(200).json({ ok: true, pong });
    }

    if (seg1 === 'me') {
      const cid = getClientId(req, res);
      const r = await getRedis();
      const [name, a1, a2, b1, b2] = await Promise.all([
        r.hGet(`user:${cid}`, 'name'),
        r.hGet(`user:${cid}`, 'Admin'),
        r.hGet(`user:${cid}`, 'admin'),
        r.hGet(`user:${cid}`, 'Banned'),
        r.hGet(`user:${cid}`, 'banned'),
      ]);
      const admin = isTrueish(a1 ?? a2);
      const banned = isTrueish(b1 ?? b2);
      noStore(res);
      return res.status(200).json({ id: cid, name: name || '', admin, banned });
    }

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

    if (seg1 === 'count') {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).send('Method Not Allowed'); }
      getClientId(req, res);
      const r = await getRedis();
      const val = await r.get('global_count');
      noStore(res);
      return res.status(200).json({ count: Number(val) || 0 });
    }

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

    return res.status(404).json({ error: 'Not Found', route });
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: e?.message || 'Internal Error' });
  }
}
