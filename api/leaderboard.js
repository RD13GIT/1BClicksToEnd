// api/leaderboard.js
import { getRedis } from './_redis.js';
import { getClientId } from './_id.js';
import { isTrueish } from './_adminUser.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    getClientId(req, res);
    const redis = await getRedis();

    // Fetch more than needed, then filter banned
    const CANDIDATES = 50;
    const raw = await redis.zRangeWithScores('leaderboard', 0, CANDIDATES - 1, { REV: true });

    // Fetch names + banned flags
    const [names, bans] = await Promise.all([
      Promise.all(raw.map(({ value: id }) => redis.hGet(`user:${id}`, 'name'))),
      Promise.all(raw.map(({ value: id }) =>
        redis.hGet(`user:${id}`, 'Banned').then(v => v ?? redis.hGet(`user:${id}`, 'banned'))
      )),
    ]);

    // Filter out banned
    const leaders = [];
    for (let i = 0; i < raw.length && leaders.length < 10; i++) {
      const id = raw[i].value;
      const score = Number(raw[i].score) || 0;
      const banned = isTrueish(bans[i]);
      if (!banned) leaders.push({ id, name: names[i] || 'Anonymous', count: score });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ leaders });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
}
