// api/admin/user-delta.js
import { getRedis } from '../_redis.js';
import { requireAdminUser } from '../_adminUser.js';

async function readJSON(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw = ''; req.on('data', (c) => (raw += c));
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  const auth = await requireAdminUser(req, res);
  if (!auth.ok) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const body = await readJSON(req);
    const id = (body?.id || '').trim();
    const delta = Math.floor(Number(body?.delta));
    if (!id) return res.status(400).json({ error: 'Missing id' });
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ error: 'delta must be a non-zero integer' });
    }

    const redis = await getRedis();
    let newScore = await redis.zIncrBy('leaderboard', delta, id);
    if (newScore < 0) {
      await redis.zAdd('leaderboard', [{ value: id, score: 0 }]);
      newScore = 0;
    }

    res.status(200).json({ ok: true, id, count: Number(newScore) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update user count: ' + (e?.message || 'unknown') });
  }
}
