import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { TunnelMessage, HttpResponsePayload, ClientMapping } from '../shared/types';
import { ClientManager } from './client-manager';

export class TunnelWebSocketServer {
  private wss: WebSocketServer;
  private clientManager: ClientManager;
  private heartbeatInterval: NodeJS.Timeout;
  private httpPort: number;

  constructor(wss: WebSocketServer, clientManager: ClientManager, httpPort: number = 3000) {
    this.wss = wss;
    this.clientManager = clientManager;
    this.httpPort = httpPort;

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log(`🔌 New WebSocket connection from ${req.socket.remoteAddress}`);
      
      ws.on('message', (data: Buffer) => {
        try {
          const message: TunnelMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', (code: number, reason: Buffer) => {
        console.log(`🔌 WebSocket connection closed: ${code} ${reason.toString()}`);
        this.clientManager.unregisterClient(ws);
      });

      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        this.clientManager.unregisterClient(ws);
      });

      // Send registration request
      this.sendMessage(ws, {
        id: uuidv4(),
        type: 'register',
        timestamp: Date.now(),
      });
    });

    console.log('📡 WebSocket server initialized');
  }

  private handleMessage(ws: WebSocket, message: TunnelMessage) {
    switch (message.type) {
      case 'register':
        this.handleRegister(ws, message);
        break;
        
      case 'response':
        this.handleResponse(message);
        break;
        
      case 'error':
        this.handleError(message);
        break;
        
      case 'heartbeat':
        this.handleHeartbeat(ws, message);
        break;
        
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private handleRegister(ws: WebSocket, message: TunnelMessage) {
    const clientId = message.clientId || uuidv4();
    const clientName = message.payload?.name || 'Unknown Client';
    const mappings = message.payload?.mappings || [];
    
    const clientInfo = this.clientManager.registerClient(clientId, ws, {
      name: clientName,
      mappings: mappings,
    });
    
    console.log(`✅ Client registered: ${clientInfo.id} (${clientInfo.name})`);
    
    // Display routing information for the new client
    this.displayClientRoutingInfo(clientInfo.id, clientInfo.name, mappings);
    
    // Confirm registration
    this.sendMessage(ws, {
      id: uuidv4(),
      type: 'register',
      timestamp: Date.now(),
      clientId: clientInfo.id,
      payload: { confirmed: true }
    });
  }

  private displayClientRoutingInfo(clientId: string, clientName: string, mappings: ClientMapping[]) {
    console.log('');
    console.log('📡 ========================================');
    console.log(`📡 НОВЫЙ КЛИЕНТ ПОДКЛЮЧЕН: ${clientName}`);
    console.log('📡 ========================================');
    console.log('');
    console.log(`🆔 Client ID: ${clientId}`);
    
    if (mappings && mappings.length > 0) {
      console.log(`🗺️  Зарегистрировано ${mappings.length} мапингов:`);
      console.log('');
      
      mappings.forEach((mapping, index) => {
        console.log(`   ${index + 1}. ${mapping.prefix.toUpperCase()}:`);
        console.log(`      📍 Адрес: http://localhost:${this.httpPort}/client/${clientId}/${mapping.prefix}`);
        console.log(`      🎯 Цель:  ${mapping.target}`);
        console.log(`      📝 Описание: ${mapping.description}`);
        console.log('');
      });
      
      console.log(`   📁 DEFAULT (fallback):`);
      console.log(`      📍 Адрес: http://localhost:${this.httpPort}/client/${clientId}/`);
      console.log(`      📝 Описание: Основное приложение (fallback)`);
      console.log('');
      
      console.log('🧪 Примеры тестирования мапингов:');
      mappings.forEach(mapping => {
        console.log(`   curl "http://localhost:${this.httpPort}/client/${clientId}/${mapping.prefix}/api/info"`);
        console.log(`   curl "http://localhost:${this.httpPort}/client/${clientId}/${mapping.prefix}/health"`);
      });
      console.log(`   curl "http://localhost:${this.httpPort}/client/${clientId}/health" # fallback`);
    } else {
      console.log(`📍 Единый адрес: http://localhost:${this.httpPort}/client/${clientId}`);
      console.log('');
      console.log('🌐 Примеры обращения к клиенту:');
      console.log(`   curl "http://localhost:${this.httpPort}/client/${clientId}/api/status"`);
      console.log(`   curl "http://localhost:${this.httpPort}/client/${clientId}/health"`);
      console.log(`   curl "http://localhost:${this.httpPort}/client/${clientId}/"`);
    }
    
    console.log('');
    console.log('🔍 Управление клиентом:');
    console.log(`   curl "http://localhost:${this.httpPort}/clients/${clientId}"`);
    console.log(`   curl "http://localhost:${this.httpPort}/client/${clientId}/health"`);
    console.log('');
    console.log('📊 Общая информация:');
    console.log(`   curl "http://localhost:${this.httpPort}/clients"           # Все клиенты`);
    console.log(`   curl "http://localhost:${this.httpPort}/status"            # Статус системы`);
    console.log('');
    
    // Show total connected clients
    const totalClients = this.clientManager.getConnectedClients().length;
    console.log(`📈 Всего подключено клиентов: ${totalClients}`);
    
    if (mappings && mappings.length > 0) {
      const totalMappings = this.clientManager.getStats().totalMappings;
      console.log(`🗺️  Всего мапингов в системе: ${totalMappings}`);
    }
    
    console.log('📡 ========================================');
    console.log('');
  }

  private handleResponse(message: TunnelMessage) {
    const response = message.payload as HttpResponsePayload;
    this.clientManager.resolveRequest(message.id, response);
  }

  private handleError(message: TunnelMessage) {
    const error = new Error(message.payload?.message || 'Client error');
    this.clientManager.rejectRequest(message.id, error);
  }

  private handleHeartbeat(ws: WebSocket, message: TunnelMessage) {
    if (message.clientId) {
      this.clientManager.updateHeartbeat(message.clientId);
    }
    
    // Send pong response
    this.sendMessage(ws, {
      id: message.id,
      type: 'pong',
      timestamp: Date.now(),
    });
  }

  public sendRequestToClient(clientId: string, requestId: string, payload: any): boolean {
    const client = this.clientManager.getClient(clientId);
    if (!client || !client.connected) {
      return false;
    }

    this.sendMessage(client.ws, {
      id: requestId,
      type: 'request',
      timestamp: Date.now(),
      payload,
    });

    return true;
  }

  private sendMessage(ws: WebSocket, message: TunnelMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, errorMessage: string) {
    this.sendMessage(ws, {
      id: uuidv4(),
      type: 'error',
      timestamp: Date.now(),
      payload: { message: errorMessage },
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clientManager.checkHeartbeats();
      
      // Send heartbeat to all connected clients
      const clients = this.clientManager.getConnectedClients();
      clients.forEach(client => {
        this.sendMessage(client.ws, {
          id: uuidv4(),
          type: 'heartbeat',
          timestamp: Date.now(),
        });
      });
    }, 30000); // Every 30 seconds
  }

  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}