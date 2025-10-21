// api/leaderboard.js
import { getRedis } from './_redis.js';
import { getClientId } from './_id.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    // ensure cid cookie exists even if user hasn’t clicked yet
    getClientId(req, res);

    const redis = await getRedis();

    // Top 10 by score
    const top = await redis.zRangeWithScores('leaderboard', 0, 9, { REV: true });

    // Fetch names for each id
    const names = await Promise.all(
      top.map(({ value: id }) => redis.hGet(`user:${id}`, 'name'))
    );

    const leaders = top.map(({ value: id, score }, i) => ({
      id,
      name: names[i] || 'Anonymous',
      count: Number(score) || 0
    }));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ leaders });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to get leaderboard' });
  }
}
