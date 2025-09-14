import { TunnelWebSocketClient } from './websocket';
import { HttpClient } from './http-client';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const CONFIG = {
  SERVER_URL: process.env.SERVER_WS_URL || 'ws://localhost:3001',
  LOCAL_TARGET: process.env.LOCAL_TARGET || 'http://localhost:8080',
  CLIENT_ID: process.env.CLIENT_ID || uuidv4(),
  CLIENT_NAME: process.env.CLIENT_NAME || `PC-Client-${Date.now()}`,
  RECONNECT_INTERVAL: 5000, // 5 seconds
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
};

console.log('🚀 Starting WebSocket Tunnel Client');
console.log(`📡 Server URL: ${CONFIG.SERVER_URL}`);
console.log(`🎯 Local Target: ${CONFIG.LOCAL_TARGET}`);
console.log(`🆔 Client ID: ${CONFIG.CLIENT_ID}`);
console.log(`📝 Client Name: ${CONFIG.CLIENT_NAME}`);

// Initialize components
const httpClient = new HttpClient(CONFIG.LOCAL_TARGET);
const wsClient = new TunnelWebSocketClient(CONFIG.SERVER_URL, {
  clientId: CONFIG.CLIENT_ID,
  clientName: CONFIG.CLIENT_NAME,
  reconnectInterval: CONFIG.RECONNECT_INTERVAL,
  heartbeatInterval: CONFIG.HEARTBEAT_INTERVAL,
});

// Handle incoming requests from the server
wsClient.onRequest(async (requestId, payload) => {
  console.log(`📨 Received request ${requestId}: ${payload.method} ${payload.path}`);
  
  try {
    const startTime = Date.now();
    const response = await httpClient.makeRequest(payload);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Request ${requestId} completed: ${response.statusCode} (${duration}ms)`);
    
    wsClient.sendResponse(requestId, {
      ...response,
      duration,
    });
    
  } catch (error) {
    console.error(`❌ Request ${requestId} failed:`, error);
    
    wsClient.sendError(requestId, {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'REQUEST_FAILED',
    });
  }
});

// Handle connection events
wsClient.onConnect(() => {
  console.log('✅ Connected to tunnel server');
});

wsClient.onDisconnect(() => {
  console.log('❌ Disconnected from tunnel server');
});

wsClient.onError((error) => {
  console.error('🚨 WebSocket error:', error);
});

wsClient.onRegister((confirmed) => {
  if (confirmed) {
    console.log('✅ Successfully registered with server');
  } else {
    console.log('📝 Registration requested');
  }
});

// Start the client
wsClient.connect();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down client...');
  wsClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down client...');
  wsClient.disconnect();
  process.exit(0);
});

// Keep the process alive
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export { wsClient, httpClient };
