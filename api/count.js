// api/count.js
import { getRedis } from './_redis.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const redis = await getRedis();
    const val = await redis.get('global_count');
    const count = Number(val) || 0;
    res.status(200).json({ count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get count' });
  }
}
