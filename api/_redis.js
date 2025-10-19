// api/_redis.js
import { createClient } from 'redis';

let client; // reused across warm invocations

export async function getRedis() {
  if (!client) {
    if (!process.env.REDIS_URL) {
      throw new Error('Missing REDIS_URL env var');
    }
    client = createClient({ url: process.env.REDIS_URL }); // rediss://... enables TLS
    client.on('error', (err) => console.error('Redis error:', err));
    await client.connect();
  }
  return client;
}
