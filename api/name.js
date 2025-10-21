// api/name.js
import { getRedis } from './_redis.js';
import { getClientId } from './_id.js';

async function readJSON(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  const cid = getClientId(req, res);
  const redis = await getRedis();

  if (req.method === 'GET') {
    try {
      const name = await redis.hGet(`user:${cid}`, 'name');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ id: cid, name: name || '' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to get name' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await readJSON(req);
      let name = (body?.name ?? '').toString().trim().replace(/\s+/g, ' ');

      // Basic validation
      if (name.length < 2 || name.length > 32) {
        return res.status(400).json({ error: 'Name must be 2–32 characters' });
      }

      // Save
      await redis.hSet(`user:${cid}`, { name });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, id: cid, name });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to save name' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).send('Method Not Allowed');
}
