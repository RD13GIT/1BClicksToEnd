// api/_adminUser.js
import { getRedis } from './_redis.js';
import { getClientId } from './_id.js';

function isTrueish(v) {
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
}

export async function requireAdminUser(req, res) {
  const cid = getClientId(req, res);
  const redis = await getRedis();
  // Prefer "Admin", fallback to "admin"
  const raw = (await redis.hGet(`user:${cid}`, 'Admin')) ?? (await redis.hGet(`user:${cid}`, 'admin'));
  const allowed = isTrueish(raw);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden' });
    return { ok: false };
  }
  return { ok: true, cid };
}

export { isTrueish };
