// api/ping.js
import { getRedis } from './_redis.js';

export default async function handler(req, res) {
  try {
    const url = process.env.REDIS_URL || '';
    const masked = url ? url.replace(/(:)([^@]+)(@)/, (_, a, b, c) => a + '***' + c) : null;

    const redis = await getRedis();
    const pong = await redis.ping();
    res.status(200).json({ ok: true, pong, haveEnv: !!url, redisUrlMasked: masked });
  } catch (e) {
    console.error('PING ERROR:', e);
    res.status(500).json({ ok: false, message: e?.message, stack: e?.stack });
  }
}
