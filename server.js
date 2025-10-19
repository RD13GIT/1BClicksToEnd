// server.js (CommonJS)
require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis client (TLS enabled automatically when using rediss://)
const redis = createClient({ url: REDIS_URL });
redis.on('error', (err) => console.error('Redis error:', err));

// Keep a set of SSE client responses
const clients = new Set();

function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // avoid buffering on nginx
}

function sendEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(event, payload) {
  for (const res of clients) sendEvent(res, event, payload);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SSE stream of count updates
app.get('/events', async (req, res) => {
  sseHeaders(res);
  res.flushHeaders?.();

  clients.add(res);

  // Send current count immediately
  const current = Number(await redis.get('global_count')) || 0;
  sendEvent(res, 'count', { count: current });

  // Heartbeat to keep the connection alive
  const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    res.end();
  });
});

// Get current count (useful for initial fetch)
app.get('/count', async (req, res) => {
  const current = Number(await redis.get('global_count')) || 0;
  res.json({ count: current });
});

// Increment endpoint
app.post('/increment', async (req, res) => {
  try {
    const count = await redis.incr('global_count'); // atomic
    broadcast('count', { count }); // push to all clients
    res.json({ count });
  } catch (err) {
    console.error('Increment failed:', err);
    res.status(500).json({ error: 'Increment failed' });
  }
});

// Start server after Redis connects
(async () => {
  try {
    await redis.connect();
    await redis.setNX('global_count', 0); // initialize once
    app.listen(PORT, () => {
      console.log(`Server listening at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start app:', err);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  for (const res of clients) res.end();
  try { await redis.quit(); } catch {}
  process.exit(0);
});
