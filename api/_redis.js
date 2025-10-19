import { createClient } from 'redis';

let client;

export async function getRedis() {
  if (!client) {
    if (!process.env.REDIS_URL) throw new Error('Missing REDIS_URL env var');
    client = createClient({ url: process.env.REDIS_URL }); // rediss:// enables TLS
    client.on('error', (e) => console.error('Redis error:', e));
    await client.connect();
  }
  return client;
}
