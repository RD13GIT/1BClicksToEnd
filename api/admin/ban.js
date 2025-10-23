// api/admin/ban.js
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
    const banned = !!body?.banned;
    const purge = !!body?.purge;

    if (!id) return res.status(400).json({ error: 'Missing id' });

    const redis = await getRedis();
    await redis.hSet(`user:${id}`, { Banned: banned ? 'true' : 'false' });
    if (purge) await redis.zRem('leaderboard', id);

    res.status(200).json({ ok: true, id, banned, purged: purge });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to set ban: ' + (e?.message || 'unknown') });
  }
}
