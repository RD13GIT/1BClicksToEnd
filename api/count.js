// api/count.js
import { getRedis } from './_redis.js';
import { getClientId } from './_id.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    // ensure cid cookie exists for this visitor
    getClientId(req, res);

    const redis = await getRedis();
    const val = await redis.get('global_count');
    const count = Number(val) || 0;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ count });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to get count' });
  }
}
