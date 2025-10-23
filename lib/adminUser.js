// lib/adminUser.js
import { getRedis } from './redis.js';
import { getClientId } from './id.js';

export function isTrueish(v) {
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on';
}

export async function requireAdminUser(req, res) {
  const cid = getClientId(req, res);
  const redis = await getRedis();
  const raw = (await redis.hGet(`user:${cid}`, 'Admin')) ?? (await redis.hGet(`user:${cid}`, 'admin'));
  const allowed = isTrueish(raw);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden: Admin only' });
    return { ok: false };
  }
  return { ok: true, cid };
}
