// api/admin/admin.js
import { getRedis } from '../_redis.js';
import { requireAdminUser, isTrueish } from '../_adminUser.js';

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
    if (!id) return res.status(400).json({ error: 'Missing id' });

    if (body?.admin === undefined) {
      return res.status(400).json({ error: 'Missing admin flag (true/false)' });
    }
    const makeAdmin = isTrueish(body.admin);

    const redis = await getRedis();
    // Set both keys for compatibility
    await redis.hSet(`user:${id}`, { Admin: makeAdmin ? 'true' : 'false', admin: makeAdmin ? 'true' : 'false' });

    res.status(200).json({ ok: true, id, admin: makeAdmin });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to set admin: ' + (e?.message || 'unknown') });
  }
}
