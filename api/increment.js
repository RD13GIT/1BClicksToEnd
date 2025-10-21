// api/increment.js
import { getRedis } from './_redis.js';
import { getClientId } from './_id.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const cid = getClientId(req, res);
    const redis = await getRedis();

    // Increment global + user leaderboard
    const [count] = await Promise.all([
      redis.incr('global_count'),
      redis.zIncrBy('leaderboard', 1, cid),
      redis.hSetNX(`user:${cid}`, 'name', 'Anonymous') // set once
    ]);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ count });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to increment' });
  }
}
