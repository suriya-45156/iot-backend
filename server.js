require('dotenv').config();

const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const http      = require('http');
const { WebSocketServer } = require('ws');

const readingsRouter = require('./routes/readings');
const alertsRouter   = require('./routes/alerts');

const app    = express();
const server = http.createServer(app);

// ─── WebSocket Server ────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] Client connected: ${ip}`);
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'IoT Edge Monitor WebSocket ready.' }));

  ws.on('close', () => console.log(`[WS] Client disconnected: ${ip}`));
  ws.on('error', (err) => console.error('[WS] Error:', err.message));
});

// Broadcast to all connected WebSocket clients
app.locals.broadcast = (payload) => {
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(payload);
  });
};

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/readings', readingsRouter);
app.use('/api/alerts',   alertsRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    uptime:    process.uptime().toFixed(1) + 's',
    db:        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    wsClients: wss.clients.size,
    timestamp: new Date().toISOString()
  });
});

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// ─── MongoDB + Server Boot ───────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/iot_monitor';
const PORT      = parseInt(process.env.PORT) || 3000;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(`[DB] MongoDB connected → ${MONGO_URI}`);
    server.listen(PORT, () => {
      console.log(`[API] HTTP server running  → http://localhost:${PORT}`);
      console.log(`[WS]  WebSocket server     → ws://localhost:${PORT}/ws`);
      console.log(`[API] Health check         → http://localhost:${PORT}/health`);
    });
  })
  .catch(err => {
    console.error('[DB] MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = { app, server };
