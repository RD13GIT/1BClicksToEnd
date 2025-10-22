// api/admin/set-count.js
import { getRedis } from '../_redis.js';
import { requireAdminUser } from '../_adminUser.js';

async function readJSON(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
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
    const value = Math.floor(Number(body.value));
    if (!Number.isFinite(value) || value < 0 || value > 1e15) {
      return res.status(400).json({ error: 'Invalid value' });
    }
    const redis = await getRedis();
    await redis.set('global_count', String(value));
    res.status(200).json({ ok: true, value });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to set count' });
  }
}
