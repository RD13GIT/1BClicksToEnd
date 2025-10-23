// api/admin/add-count.js
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
    const delta = Math.floor(Number(body.delta));
    if (!Number.isFinite(delta) || delta <= 0) {
      return res.status(400).json({ error: 'delta must be a positive integer' });
    }

    const redis = await getRedis();
    const count = await redis.incrBy('global_count', delta);

    res.status(200).json({ ok: true, count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add to count: ' + (e?.message || 'unknown') });
  }
}
