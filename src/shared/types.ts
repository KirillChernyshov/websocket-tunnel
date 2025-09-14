export interface TunnelMessage {
  id: string;
  type: 'request' | 'response' | 'error' | 'heartbeat' | 'register' | 'pong';
  timestamp: number;
  clientId?: string;
  payload?: any;
}

export interface HttpRequestPayload {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  query?: Record<string, any>;
  params?: Record<string, string>;
  targetMapping?: string; // Какой мапинг использовать
}

export interface HttpResponsePayload {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  duration?: number;
  mapping?: string; // Какой мапинг был использован
}

export interface ErrorPayload {
  message: string;
  code?: string;
  stack?: string;
}

// Новый интерфейс для мапинга
export interface ClientMapping {
  prefix: string;      // Префикс пути (например, "app1", "api")
  target: string;      // Целевой URL (например, "http://localhost:8000")
  description?: string; // Описание мапинга
}

export interface ClientInfo {
  id: string;
  name?: string;
  connected: boolean;
  lastHeartbeat: number;
  requestCount: number;
  mappings?: ClientMapping[]; // Список мапингов клиента
}

export interface TunnelConfig {
  server: {
    port: number;
    wsPort: number;
    heartbeatInterval: number;
    requestTimeout: number;
  };
  client: {
    serverUrl: string;
    localTarget: string; // Основной target (для обратной совместимости)
    mappings?: ClientMapping[]; // Дополнительные мапинги
    reconnectInterval: number;
    heartbeatInterval: number;
    clientId: string;
  };
}

export type MessageHandler<T = any> = (message: TunnelMessage, payload: T) => void;