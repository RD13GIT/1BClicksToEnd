import { getRedis } from './_redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const redis = await getRedis();
    const count = await redis.incr('global_count'); // atomic
    res.status(200).json({ count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to increment' });
  }
}
