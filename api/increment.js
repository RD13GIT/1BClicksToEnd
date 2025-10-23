// api/increment.js
import { getRedis } from './_redis.js';
import { getClientId } from './_id.js';
import { isTrueish } from './_adminUser.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const cid = getClientId(req, res);
    const redis = await getRedis();

    // Banned check (Banned/banned true-ish)
    const [b1, b2] = await Promise.all([
      redis.hGet(`user:${cid}`, 'Banned'),
      redis.hGet(`user:${cid}`, 'banned')
    ]);
    if (isTrueish(b1 ?? b2)) {
      return res.status(403).json({ error: 'Banned' });
    }

    const [count] = await Promise.all([
      redis.incr('global_count'),
      redis.zIncrBy('leaderboard', 1, cid),
      redis.hSetNX(`user:${cid}`, 'name', 'Anonymous'),
    ]);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to increment' });
  }
}
