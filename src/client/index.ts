import { TunnelWebSocketClient } from './websocket';
import { HttpClient } from './http-client';
import { ClientMapping } from '../shared/types';
import * as fs from 'fs';
import * as path from 'path';

// Интерфейс для JSON конфигурации
interface MappingConfig {
  client: {
    id: string;
    name: string;
    defaultTarget: string;
  };
  mappings: Array<{
    prefix: string;
    target: string;
    description: string;
    enabled: boolean;
    healthCheck?: string;
    protected?: boolean;
  }>;
  options: {
    enableFallback: boolean;
    healthCheckInterval: number;
    retryFailedRequests: boolean;
    maxRetries: number;
  };
}

// Функция для загрузки конфигурации
function loadMappingConfig(): MappingConfig {
  const configPath = path.join(process.cwd(), 'mappings.json');
  const examplePath = path.join(process.cwd(), 'mappings.json.example');
  
  // Если файл не существует - показываем четкую ошибку
  if (!fs.existsSync(configPath)) {
    console.log('');
    console.log('❌ ОШИБКА: Файл mappings.json не найден!');
    console.log('');
    console.log('🔧 Для настройки клиента выполните:');
    console.log('');
    console.log('   1. Скопируйте пример конфигурации:');
    console.log('      cp mappings.json.example mappings.json');
    console.log('');
    console.log('   2. Отредактируйте mappings.json под свои нужды:');
    console.log('      - Укажите уникальный CLIENT_ID');
    console.log('      - Настройте адреса ваших приложений');
    console.log('      - Включите/выключите нужные мапинги');
    console.log('');
    console.log('   3. Перезапустите клиент');
    console.log('');
    
    if (fs.existsSync(examplePath)) {
      console.log('📄 Пример конфигурации доступен в: mappings.json.example');
    } else {
      console.log('⚠️  Файл mappings.json.example не найден!');
    }
    
    console.log('');
    console.log('💡 mappings.json должен содержать настройки ваших приложений.');
    console.log('   БЕЗ НЕГО КЛИЕНТ НЕ ЗНАЕТ КУДА МАПИТЬ ЗАПРОСЫ!');
    console.log('');
    process.exit(1);
  }
  
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    console.log(`📄 Загружена конфигурация из: ${configPath}`);
    
    // Валидация конфигурации
    if (!config.client || !config.client.id || !config.client.name) {
      throw new Error('Отсутствует секция client или обязательные поля id/name');
    }
    
    if (!config.mappings || !Array.isArray(config.mappings)) {
      throw new Error('Отсутствует секция mappings или она не является массивом');
    }
    
    return config;
  } catch (error) {
    console.log('');
    console.log('❌ ОШИБКА В КОНФИГУРАЦИИ mappings.json:');
    console.log('');
    console.log(`   ${error}`);
    console.log('');
    console.log('🔧 Исправьте JSON синтаксис или пересоздайте файл:');
    console.log('   1. rm mappings.json');
    console.log('   2. cp mappings.json.example mappings.json');
    console.log('   3. Отредактируйте новый файл');
    console.log('');
    process.exit(1);
  }
}

// Загружаем конфигурацию
const MAPPING_CONFIG = loadMappingConfig();

// Фильтруем только активные мапинги
const activeMappings: ClientMapping[] = MAPPING_CONFIG.mappings
  .filter(mapping => mapping.enabled)
  .map(mapping => ({
    prefix: mapping.prefix,
    target: mapping.target,
    description: mapping.description
  }));

// Основная конфигурация
const CONFIG = {
  SERVER_URL: process.env.SERVER_WS_URL || 'ws://localhost:3001',
  CLIENT_ID: MAPPING_CONFIG.client.id,
  CLIENT_NAME: MAPPING_CONFIG.client.name,
  LOCAL_TARGET: MAPPING_CONFIG.client.defaultTarget,
  RECONNECT_INTERVAL: parseInt(process.env.RECONNECT_INTERVAL || '5000'),
  HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'),
  MAPPINGS: activeMappings,
};

// Helper function to get HTTP server URL from WebSocket URL
function getHttpServerUrl(wsUrl: string): string {
  try {
    const url = new URL(wsUrl);
    const protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    const port = url.port || (url.protocol === 'wss:' ? '443' : '80');
    const httpPort = url.port === '3001' ? '3000' : (parseInt(port) - 1).toString();
    return `${protocol}//${url.hostname}:${httpPort}`;
  } catch {
    return 'http://localhost:3000';
  }
}

const HTTP_SERVER_URL = getHttpServerUrl(CONFIG.SERVER_URL);

console.log('🚀 Запуск WebSocket Tunnel Client');
console.log(`📡 Сервер: ${CONFIG.SERVER_URL}`);
console.log(`🆔 Client ID: ${CONFIG.CLIENT_ID}`);
console.log(`📝 Имя: ${CONFIG.CLIENT_NAME}`);
console.log(`🎯 Основная цель: ${CONFIG.LOCAL_TARGET}`);

if (CONFIG.MAPPINGS.length > 0) {
  console.log(`🗺️  Настроено ${CONFIG.MAPPINGS.length} активных мапингов:`);
  CONFIG.MAPPINGS.forEach((mapping, index) => {
    console.log(`   ${index + 1}. ${mapping.prefix} → ${mapping.target} (${mapping.description})`);
  });
} else {
  console.log('');
  console.log('⚠️  НЕТ АКТИВНЫХ МАПИНГОВ!');
  console.log('');
  console.log('🔧 Все запросы будут направляться в defaultTarget:');
  console.log(`   ${CONFIG.LOCAL_TARGET}`);
  console.log('');
  console.log('💡 Чтобы настроить мапинги:');
  console.log('   1. Отредактируйте mappings.json');
  console.log('   2. Включите нужные мапинги (enabled: true)');
  console.log('   3. Перезапустите клиент');
  console.log('');
}

// Create HTTP clients for each mapping
const httpClients = new Map<string, HttpClient>();

// Main client (for default mapping and fallback)
const mainHttpClient = new HttpClient(CONFIG.LOCAL_TARGET);
httpClients.set('default', mainHttpClient);

// Additional clients for each mapping
CONFIG.MAPPINGS.forEach(mapping => {
  httpClients.set(mapping.target, new HttpClient(mapping.target));
});

// Initialize WebSocket client
const wsClient = new TunnelWebSocketClient(CONFIG.SERVER_URL, {
  clientId: CONFIG.CLIENT_ID,
  clientName: CONFIG.CLIENT_NAME,
  reconnectInterval: CONFIG.RECONNECT_INTERVAL,
  heartbeatInterval: CONFIG.HEARTBEAT_INTERVAL,
  mappings: CONFIG.MAPPINGS,
});

// Function to display routing information
function displayRoutingInfo() {
  console.log('');
  console.log('🎯 ========================================');
  console.log('🎯 ТУННЕЛЬ ЗАПУЩЕН!');
  console.log('🎯 ========================================');
  console.log('');
  console.log(`📍 Постоянный адрес клиента:`);
  console.log(`   ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}`);
  console.log('');
  
  if (CONFIG.MAPPINGS.length > 0) {
    console.log('🗺️  Активные мапинги:');
    console.log('');
    
    CONFIG.MAPPINGS.forEach(mapping => {
      console.log(`   📁 ${mapping.prefix.toUpperCase()}:`);
      console.log(`      ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/${mapping.prefix}/* → ${mapping.target}`);
      console.log(`      ${mapping.description}`);
      console.log('');
    });
    
    console.log(`   📁 DEFAULT (fallback):`);
    console.log(`      ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/* → ${CONFIG.LOCAL_TARGET}`);
    console.log(`      Основное приложение`);
    console.log('');
  } else {
    console.log('⚠️  ВНИМАНИЕ: НЕТ НАСТРОЕННЫХ МАПИНГОВ!');
    console.log('');
    console.log('🔄 Единственный доступный маршрут:');
    console.log(`     ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/* → ${CONFIG.LOCAL_TARGET}`);
    console.log('');
    console.log('🔧 Для настройки мапингов отредактируйте mappings.json');
    console.log('');
  }
  
  console.log('🧪 Тестовые команды:');
  console.log(`     curl "${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/"`);
  
  if (CONFIG.MAPPINGS.length > 0) {
    CONFIG.MAPPINGS.forEach(mapping => {
      console.log(`     curl "${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}/${mapping.prefix}/"`);
    });
  }
  
  console.log('');
  console.log('🎯 ========================================');
  console.log(`🎯 Адрес: ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID}`);
  console.log(`🎯 Мапингов: ${CONFIG.MAPPINGS.length} активных`);
  console.log('🎯 ========================================');
  console.log('');
}

// Function to get appropriate HTTP client for request
function getHttpClientForRequest(payload: any): HttpClient {
  if (payload.targetMapping) {
    const client = httpClients.get(payload.targetMapping);
    if (client) {
      console.log(`🎯 Маршрут через мапинг: ${payload.targetMapping}`);
      return client;
    }
  }
  
  console.log(`🎯 Маршрут через дефолт: ${CONFIG.LOCAL_TARGET}`);
  return mainHttpClient;
}

// Handle incoming requests from the server
wsClient.onRequest(async (requestId, payload) => {
  const mappingInfo = payload.targetMapping ? ` (${payload.targetMapping})` : ' (default)';
  console.log(`📨 Запрос ${requestId}: ${payload.method} ${payload.path}${mappingInfo}`);
  
  try {
    const startTime = Date.now();
    const httpClient = getHttpClientForRequest(payload);
    const response = await httpClient.makeRequest(payload);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Запрос ${requestId} выполнен: ${response.statusCode} (${duration}ms)${mappingInfo}`);
    
    wsClient.sendResponse(requestId, {
      ...response,
      duration,
    });
    
  } catch (error) {
    console.error(`❌ Запрос ${requestId} ошибка:`, error);
    
    wsClient.sendError(requestId, {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'REQUEST_FAILED',
    });
  }
});

// Handle connection events
wsClient.onConnect(() => {
  console.log('✅ Подключен к серверу туннеля');
});

wsClient.onDisconnect(() => {
  console.log('❌ Отключен от сервера туннеля');
  console.log('🔄 Туннель временно недоступен...');
});

wsClient.onError((error) => {
  console.error('🚨 WebSocket ошибка:', error);
});

wsClient.onRegister((confirmed) => {
  if (confirmed) {
    console.log('✅ Успешно зарегистрирован на сервере');
    console.log(`🎉 Клиент "${CONFIG.CLIENT_NAME}" (${CONFIG.CLIENT_ID}) онлайн!`);
    
    if (CONFIG.MAPPINGS.length > 0) {
      console.log(`🗺️  Зарегистрировано с ${CONFIG.MAPPINGS.length} активными мапингами`);
    } else {
      console.log('⚠️  Зарегистрировано БЕЗ активных мапингов (только default)');
    }
    
    displayRoutingInfo();
  } else {
    console.log('📝 Запрос регистрации отправлен...');
  }
});

// Start the client
wsClient.connect();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Остановка клиента...');
  console.log(`🔌 Туннель ${HTTP_SERVER_URL}/client/${CONFIG.CLIENT_ID} станет недоступен`);
  wsClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Остановка клиента...');
  wsClient.disconnect();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Необработанное исключение:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Необработанный reject:', promise, 'причина:', reason);
  process.exit(1);
});

export { wsClient, httpClients, CONFIG, MAPPING_CONFIG };