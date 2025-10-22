// api/admin/reset.js
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
    const scope = (body.scope || 'all').toLowerCase(); // 'count' | 'leaderboard' | 'all'
    const confirm = body.confirm;

    if (confirm !== 'RESET') {
      return res.status(400).json({ error: 'Missing confirm. Send { "confirm": "RESET" }' });
    }

    const redis = await getRedis();
    if (scope === 'count') {
      await redis.set('global_count', '0');
    } else if (scope === 'leaderboard') {
      await redis.del('leaderboard');
    } else if (scope === 'all') {
      await redis.multi().set('global_count', '0').del('leaderboard').exec();
    } else {
      return res.status(400).json({ error: 'Invalid scope' });
    }

    res.status(200).json({ ok: true, scope });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reset' });
  }
}
