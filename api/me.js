// api/me.js
import { getRedis } from './_redis.js';
import { getClientId } from './_id.js';
import { isTrueish } from './_adminUser.js';

export default async function handler(req, res) {
  try {
    const cid = getClientId(req, res);
    const redis = await getRedis();
    const [name, a1, a2] = await Promise.all([
      redis.hGet(`user:${cid}`, 'name'),
      redis.hGet(`user:${cid}`, 'Admin'),
      redis.hGet(`user:${cid}`, 'admin'),
    ]);
    const admin = isTrueish(a1 ?? a2);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ id: cid, name: name || '', admin });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load current user' });
  }
}
