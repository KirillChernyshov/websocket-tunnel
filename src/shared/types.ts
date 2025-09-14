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
}

export interface HttpResponsePayload {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  duration?: number;
}

export interface ErrorPayload {
  message: string;
  code?: string;
  stack?: string;
}

export interface ClientInfo {
  id: string;
  name?: string;
  connected: boolean;
  lastHeartbeat: number;
  requestCount: number;
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
    localTarget: string;
    reconnectInterval: number;
    heartbeatInterval: number;
    clientId: string;
  };
}

export type MessageHandler<T = any> = (message: TunnelMessage, payload: T) => void;
