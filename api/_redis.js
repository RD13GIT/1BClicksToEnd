// api/_redis.js
import { createClient } from 'redis';

let client;

export async function getRedis() {
  if (client?.isOpen) return client;

  const url = process.env.REDIS_URL;
  if (!url) throw new Error('Missing REDIS_URL env var');

  client = createClient({
    url,
    socket: {
      keepAlive: 5000,
      connectTimeout: 10000
    }
  });

  client.on('error', (e) => console.error('Redis error:', e));
  await client.connect();
  return client;
}
