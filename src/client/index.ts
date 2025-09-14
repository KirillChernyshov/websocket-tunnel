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

// Helper function to get HTTP server URL from WebSocket URL
function getHttpServerUrl(wsUrl: string): string {
  try {
    const url = new URL(wsUrl);
    const protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    const port = url.port || (url.protocol === 'wss:' ? '443' : '80');
    // Default HTTP port is usually WS_PORT - 1 (3000 vs 3001)
    const httpPort = url.port === '3001' ? '3000' : (parseInt(port) - 1).toString();
    return `${protocol}//${url.hostname}:${httpPort}`;
  } catch {
    return 'http://localhost:3000';
  }
}

const HTTP_SERVER_URL = getHttpServerUrl(CONFIG.SERVER_URL);

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

// Function to display routing information
function displayRoutingInfo() {
  console.log('');
  console.log('🎯 ========================================');
  console.log('🎯 ТУННЕЛЬ ГОТОВ К ИСПОЛЬЗОВАНИЮ!');
  console.log('🎯 ========================================');
  console.log('');
  console.log(`📍 Постоянный адрес клиента:`);
  console.log(`   ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}`);
  console.log('');
  console.log('🌐 Примеры использования:');
  console.log('');
  console.log('  📄 Статические файлы:');
  console.log(`     ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/index.html`);
  console.log(`     ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/api/status`);
  console.log('');
  console.log('  🔄 API запросы:');
  console.log(`     GET  ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/api/users`);
  console.log(`     POST ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/api/data`);
  console.log(`     PUT  ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/api/settings`);
  console.log('');
  console.log('  🧪 Тестовые запросы:');
  console.log(`     curl "${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/api/test"`);
  console.log(`     curl "${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/health"`);
  console.log('');
  console.log('  🔍 Управление клиентом:');
  console.log(`     curl "${HTTP_SERVER_URL}/clients/${CONFIG.CLIENT_ID}"`);
  console.log(`     curl "${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/health"`);
  console.log('');
  console.log('  📊 Из браузера:');
  console.log(`     ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/`);
  console.log('');
  console.log('⚖️  Балансированная маршрутизация (любой клиент):');
  console.log(`     ${HTTP_SERVER_URL}/api/endpoint`);
  console.log('');
  console.log('📋 Информация о системе:');
  console.log(`     ${HTTP_SERVER_URL}/clients           # Список всех клиентов`);
  console.log(`     ${HTTP_SERVER_URL}/health            # Статус сервера`);
  console.log(`     ${HTTP_SERVER_URL}/status            # Подробная информация`);
  console.log('');
  console.log('🎯 ========================================');
  console.log(`🎯 Локальное приложение: ${CONFIG.LOCAL_TARGET}`);
  console.log(`🎯 Доступно через туннель: ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}`);
  console.log('🎯 ========================================');
  console.log('');
}

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
  console.log('🔄 Tunnel temporarily unavailable...');
});

wsClient.onError((error) => {
  console.error('🚨 WebSocket error:', error);
});

wsClient.onRegister((confirmed) => {
  if (confirmed) {
    console.log('✅ Successfully registered with server');
    console.log(`🎉 Client "${CONFIG.CLIENT_NAME}" (${CONFIG.CLIENT_ID}) is now online!`);
    
    // Display routing information after successful registration
    displayRoutingInfo();
  } else {
    console.log('📝 Registration requested...');
  }
});

// Start the client
wsClient.connect();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Shutting down client...');
  console.log(`🔌 Tunnel ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID} will be unavailable`);
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