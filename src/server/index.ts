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
const tunnelWs = new TunnelWebSocketServer(wss, clientManager, CONFIG.HTTP_PORT);
const proxyHandler = new HttpProxyHandler(clientManager, CONFIG.REQUEST_TIMEOUT);

// ===== CLIENT MANAGEMENT API =====

// Get all clients
app.get('/clients', (req, res) => {
  const clients = clientManager.getConnectedClients();
  res.json({
    total: clients.length,
    clients: clients.map(c => ({
      id: c.id,
      name: c.name,
      connected: c.connected,
      lastHeartbeat: new Date(c.lastHeartbeat).toISOString(),
      requestCount: c.requestCount,
      // Add permanent address information
      permanentAddress: `/client/${c.id}`,
      healthEndpoint: `/client/${c.id}/health`,
      examples: {
        getRequest: `GET /client/${c.id}/api/some-endpoint`,
        postRequest: `POST /client/${c.id}/api/data`
      }
    }))
  });
});

// Get specific client info
app.get('/clients/:clientId', (req, res) => {
  const clientId = req.params.clientId;
  const client = clientManager.getClient(clientId);
  
  if (!client) {
    return res.status(404).json({
      error: 'Client not found',
      clientId,
      availableClients: clientManager.getConnectedClients().map(c => ({
        id: c.id,
        name: c.name
      }))
    });
  }

  res.json({
    id: client.id,
    name: client.name,
    connected: client.connected,
    lastHeartbeat: new Date(client.lastHeartbeat).toISOString(),
    requestCount: client.requestCount,
    permanentAddress: `/client/${client.id}`,
    healthEndpoint: `/client/${client.id}/health`,
    uptime: Date.now() - client.lastHeartbeat,
    examples: {
      getRequest: `GET /client/${client.id}/api/some-endpoint`,
      postRequest: `POST /client/${client.id}/api/data`,
      curlExample: `curl -X GET "http://localhost:${CONFIG.HTTP_PORT}/client/${client.id}/api/status"`
    }
  });
});

// Health check for specific client
app.get('/client/:clientId/health', async (req, res) => {
  const clientId = req.params.clientId;
  
  try {
    const requestId = uuidv4();
    
    // Send a health check request to the specific client
    const result = await proxyHandler.handleRequestToClient(clientId, {
      id: requestId,
      method: 'GET',
      path: '/health',
      headers: {
        'User-Agent': 'WebSocket-Tunnel-Health-Check',
        'Content-Type': 'application/json'
      },
      query: {}
    });

    res.status(result.statusCode).json({
      clientId,
      status: 'healthy',
      response: {
        statusCode: result.statusCode,
        duration: result.duration,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(503).json({
      clientId,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// ===== SYSTEM API =====

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = clientManager.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: {
      httpPort: CONFIG.HTTP_PORT,
      wsPort: CONFIG.WS_PORT,
      uptime: process.uptime()
    },
    clients: {
      total: stats.totalClients,
      connected: stats.connectedClients,
      pending_requests: stats.pendingRequests
    },
    routing: {
      supportedPatterns: [
        '/client/{clientId}/* - Route to specific client',
        '/api/* - Balanced routing across all clients',
        '/* - Default balanced routing'
      ]
    }
  });
});

// Status endpoint for monitoring
app.get('/status', (req, res) => {
  const clients = clientManager.getConnectedClients();
  const stats = proxyHandler.getStats();
  
  res.json({
    connectedClients: clients.length,
    clients: clients.map(c => ({
      id: c.id,
      name: c.name,
      connected: c.connected,
      lastHeartbeat: new Date(c.lastHeartbeat).toISOString(),
      requestCount: c.requestCount,
      permanentAddress: `/client/${c.id}`
    })),
    systemStats: stats,
    routes: {
      clientManagement: [
        'GET /clients - List all clients',
        'GET /clients/{clientId} - Get client details',
        'GET /client/{clientId}/health - Health check for specific client'
      ],
      dataRouting: [
        'ANY /client/{clientId}/* - Route to specific client',
        'ANY /api/* - Balanced routing',
        'ANY /* - Default balanced routing'
      ]
    }
  });
});

// Route info endpoint (for debugging)
app.get('/route-info', (req, res) => {
  const path = req.query.path as string;
  
  if (!path) {
    return res.status(400).json({
      error: 'Missing path parameter',
      usage: '/route-info?path=/your/path'
    });
  }

  const routeInfo = proxyHandler.getRouteInfo(path);
  res.json({
    input: path,
    routeInfo,
    explanation: routeInfo.routeType === 'specific' 
      ? `Will route to client '${routeInfo.clientId}' with path '${routeInfo.targetPath}'`
      : `Will use balanced routing across all connected clients with path '${routeInfo.targetPath}'`
  });
});

// ===== PROXY ROUTING =====

// Proxy all other requests through the tunnel with enhanced routing
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

    // Use the enhanced routing system
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
      error: 'Proxy error',
      message: error instanceof Error ? error.message : 'Unknown error',
      suggestion: error instanceof Error && error.message.includes('not found') 
        ? 'Check /clients to see available clients'
        : 'Check /health for system status'
    });
  }
});

// Start servers
server.listen(CONFIG.HTTP_PORT, () => {
  console.log('🚀 Enhanced WebSocket Tunnel Server Starting...');
  console.log(`📡 HTTP Proxy Server: http://localhost:${CONFIG.HTTP_PORT}`);
  console.log(`🔌 WebSocket Server: ws://localhost:${CONFIG.WS_PORT}`);
  console.log('');
  console.log('📋 API Endpoints:');
  console.log(`   🏥 Health: http://localhost:${CONFIG.HTTP_PORT}/health`);
  console.log(`   📊 Status: http://localhost:${CONFIG.HTTP_PORT}/status`);
  console.log(`   👥 Clients: http://localhost:${CONFIG.HTTP_PORT}/clients`);
  console.log('');
  console.log('🎯 Routing Patterns:');
  console.log(`   📍 Specific Client: /client/{clientId}/*`);
  console.log(`   ⚖️  Balanced Routing: /api/* or /*`);
  console.log('');
  console.log('📖 Examples:');
  console.log(`   curl http://localhost:${CONFIG.HTTP_PORT}/clients`);
  console.log(`   curl http://localhost:${CONFIG.HTTP_PORT}/client/CLIENT_ID/api/test`);
});

// Start heartbeat checker
setInterval(() => {
  clientManager.checkHeartbeats();
}, CONFIG.HEARTBEAT_INTERVAL);

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