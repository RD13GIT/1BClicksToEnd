// lib/redis.js
import { createClient } from 'redis';

let client;
let connecting;

export async function getRedis() {
  if (client?.isOpen) return client;

  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('Missing REDIS_URL env var');

    client = createClient({
      url,
      socket: {
        tls: url.startsWith('rediss://'),
        keepAlive: 5000,
        connectTimeout: 10000
      },
      disableOfflineQueue: true,
      maxRetriesPerRequest: 2
    });

    client.on('error', (e) => console.error('Redis error:', e));
    connecting = client.connect().catch((e) => {
      connecting = null;
      throw e;
    });
  }

  if (connecting) await connecting;
  return client;
}
