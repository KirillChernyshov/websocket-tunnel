import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { TunnelWebSocketServer } from './websocket';
import { HttpProxyHandler } from './http-proxy';
import { ClientManager } from './client-manager';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Configuration
const CONFIG = {
  HTTP_PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  WS_PORT: process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3001,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
};

// Initialize components
const clientManager = new ClientManager();
const wss = new WebSocketServer({ port: CONFIG.WS_PORT });
const tunnelWs = new TunnelWebSocketServer(wss, clientManager);
const proxyHandler = new HttpProxyHandler(clientManager, CONFIG.REQUEST_TIMEOUT);

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = clientManager.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    clients: stats,
    config: {
      httpPort: CONFIG.HTTP_PORT,
      wsPort: CONFIG.WS_PORT,
    }
  });
});

// Status endpoint for monitoring
app.get('/status', (req, res) => {
  const clients = clientManager.getConnectedClients();
  res.json({
    connectedClients: clients.length,
    clients: clients.map(c => ({
      id: c.id,
      name: c.name,
      connected: c.connected,
      lastHeartbeat: new Date(c.lastHeartbeat).toISOString(),
      requestCount: c.requestCount
    }))
  });
});

// Proxy all other requests through the tunnel
app.use('*', async (req, res) => {
  try {
    const requestId = uuidv4();
    console.log(`[${requestId}] Incoming request: ${req.method} ${req.originalUrl}`);
    
    // Get raw body for non-JSON requests
    let body = req.body;
    if (Buffer.isBuffer(body)) {
      body = body.toString();
    } else if (typeof body === 'object') {
      body = JSON.stringify(body);
    }

    const result = await proxyHandler.handleRequest({
      id: requestId,
      method: req.method,
      path: req.originalUrl,
      headers: req.headers as Record<string, string>,
      body,
      query: req.query as Record<string, any>,
    });

    // Set response headers
    Object.entries(result.headers).forEach(([key, value]) => {
      res.set(key, value);
    });

    res.status(result.statusCode);
    res.send(result.body);

    console.log(`[${requestId}] Response sent: ${result.statusCode} (${result.duration}ms)`);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start servers
server.listen(CONFIG.HTTP_PORT, () => {
  console.log(`🚀 HTTP Proxy Server running on port ${CONFIG.HTTP_PORT}`);
  console.log(`📡 WebSocket Server running on port ${CONFIG.WS_PORT}`);
  console.log(`🔍 Health check: http://localhost:${CONFIG.HTTP_PORT}/health`);
  console.log(`📊 Status: http://localhost:${CONFIG.HTTP_PORT}/status`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down servers...');
  wss.close();
  server.close(() => {
    console.log('✅ Servers closed');
    process.exit(0);
  });
});

export { app, server, wss };
