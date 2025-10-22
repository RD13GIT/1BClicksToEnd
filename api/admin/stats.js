// api/admin/stats.js
import { getRedis } from '../_redis.js';
import { requireAdminUser } from '../_adminUser.js';

export default async function handler(req, res) {
  const auth = await requireAdminUser(req, res);
  if (!auth.ok) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const redis = await getRedis();
    const [gc, total] = await Promise.all([
      redis.get('global_count'),
      redis.zCard('leaderboard'),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      global_count: Number(gc) || 0,
      leaderboard_size: Number(total) || 0,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}
