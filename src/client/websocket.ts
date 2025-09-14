import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { TunnelMessage, HttpRequestPayload, HttpResponsePayload, ErrorPayload, ClientMapping } from '../shared/types';

interface ClientConfig {
  clientId: string;
  clientName: string;
  reconnectInterval: number;
  heartbeatInterval: number;
  mappings?: ClientMapping[]; // Добавляем поддержку мапингов
}

export class TunnelWebSocketClient {
  private serverUrl: string;
  private config: ClientConfig;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private isRegistered = false;
  
  // Event handlers
  private onRequestHandler: ((requestId: string, payload: HttpRequestPayload) => void) | null = null;
  private onConnectHandler: (() => void) | null = null;
  private onDisconnectHandler: (() => void) | null = null;
  private onErrorHandler: ((error: Error) => void) | null = null;
  private onRegisterHandler: ((confirmed: boolean) => void) | null = null;

  constructor(serverUrl: string, config: ClientConfig) {
    this.serverUrl = serverUrl;
    this.config = config;
  }

  public connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      console.log('⏳ Connection already in progress...');
      return;
    }

    console.log(`🔌 Connecting to ${this.serverUrl}...`);
    
    try {
      this.ws = new WebSocket(this.serverUrl);
      this.setupWebSocketHandlers();
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isRegistered = false;
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      console.log('✅ WebSocket connection established');
      this.isConnected = true;
      this.clearReconnectTimer();
      
      if (this.onConnectHandler) {
        this.onConnectHandler();
      }
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const message: TunnelMessage = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('❌ Failed to parse message:', error);
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.log(`❌ WebSocket connection closed: ${code} ${reason.toString()}`);
      this.isConnected = false;
      this.isRegistered = false;
      this.clearHeartbeatTimer();
      
      if (this.onDisconnectHandler) {
        this.onDisconnectHandler();
      }
      
      this.scheduleReconnect();
    });

    this.ws.on('error', (error: Error) => {
      console.error('🚨 WebSocket error:', error);
      
      if (this.onErrorHandler) {
        this.onErrorHandler(error);
      }
    });
  }

  private handleMessage(message: TunnelMessage): void {
    switch (message.type) {
      case 'register':
        this.handleRegister(message);
        break;
        
      case 'request':
        this.handleRequest(message);
        break;
        
      case 'heartbeat':
        this.handleHeartbeat(message);
        break;
        
      case 'pong':
        // Heartbeat response received
        break;
        
      default:
        console.warn(`⚠️ Unknown message type: ${message.type}`);
    }
  }

  private handleRegister(message: TunnelMessage): void {
    if (message.payload?.confirmed) {
      this.isRegistered = true;
      this.startHeartbeat();
      
      if (this.onRegisterHandler) {
        this.onRegisterHandler(true);
      }
    } else {
      // Server is requesting registration
      const registrationPayload = {
        name: this.config.clientName,
        mappings: this.config.mappings || [], // Передаем мапинги при регистрации
      };

      if (this.config.mappings && this.config.mappings.length > 0) {
        console.log(`📝 Registering with ${this.config.mappings.length} mappings:`);
        this.config.mappings.forEach((mapping, index) => {
          console.log(`   ${index + 1}. ${mapping.prefix} -> ${mapping.target} (${mapping.description})`);
        });
      }

      this.sendMessage({
        id: uuidv4(),
        type: 'register',
        timestamp: Date.now(),
        clientId: this.config.clientId,
        payload: registrationPayload,
      });
      
      if (this.onRegisterHandler) {
        this.onRegisterHandler(false);
      }
    }
  }

  private handleRequest(message: TunnelMessage): void {
    const payload = message.payload as HttpRequestPayload;
    
    if (this.onRequestHandler) {
      this.onRequestHandler(message.id, payload);
    } else {
      console.warn('⚠️ No request handler registered, sending error response');
      this.sendError(message.id, {
        message: 'No request handler available',
        code: 'NO_HANDLER',
      });
    }
  }

  private handleHeartbeat(message: TunnelMessage): void {
    // Respond to heartbeat
    this.sendMessage({
      id: message.id,
      type: 'heartbeat',
      timestamp: Date.now(),
      clientId: this.config.clientId,
    });
  }

  private sendMessage(message: TunnelMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ Cannot send message: WebSocket not connected');
    }
  }

  public sendResponse(requestId: string, response: HttpResponsePayload): void {
    this.sendMessage({
      id: requestId,
      type: 'response',
      timestamp: Date.now(),
      payload: response,
    });
  }

  public sendError(requestId: string, error: ErrorPayload): void {
    this.sendMessage({
      id: requestId,
      type: 'error',
      timestamp: Date.now(),
      payload: error,
    });
  }

  private startHeartbeat(): void {
    this.clearHeartbeatTimer();
    
    this.heartbeatTimer = setInterval(() => {
      this.sendMessage({
        id: uuidv4(),
        type: 'heartbeat',
        timestamp: Date.now(),
        clientId: this.config.clientId,
      });
    }, this.config.heartbeatInterval);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    console.log(`🔄 Scheduling reconnect in ${this.config.reconnectInterval}ms...`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearReconnectTimer();
    this.clearHeartbeatTimer();
  }

  // Event handler setters
  public onRequest(handler: (requestId: string, payload: HttpRequestPayload) => void): void {
    this.onRequestHandler = handler;
  }

  public onConnect(handler: () => void): void {
    this.onConnectHandler = handler;
  }

  public onDisconnect(handler: () => void): void {
    this.onDisconnectHandler = handler;
  }

  public onError(handler: (error: Error) => void): void {
    this.onErrorHandler = handler;
  }

  public onRegister(handler: (confirmed: boolean) => void): void {
    this.onRegisterHandler = handler;
  }

  // Getters
  public get connected(): boolean {
    return this.isConnected;
  }

  public get registered(): boolean {
    return this.isRegistered;
  }

  // Получить информацию о мапингах
  public get mappings(): ClientMapping[] {
    return this.config.mappings || [];
  }
}