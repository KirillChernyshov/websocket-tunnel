import { WebSocket } from 'ws';
import { ClientInfo, HttpResponsePayload, ClientMapping } from '../shared/types';

interface PendingRequest {
  id: string;
  timestamp: number;
  resolve: (value: HttpResponsePayload) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface RegisteredClient extends ClientInfo {
  ws: WebSocket;
}

export class ClientManager {
  private clients = new Map<string, RegisteredClient>();
  private pendingRequests = new Map<string, PendingRequest>();
  private requestTimeout: number = 30000; // 30 seconds
  private heartbeatTimeout: number = 90000; // 90 seconds (3 missed heartbeats)

  public registerClient(
    clientId: string, 
    ws: WebSocket, 
    options: { 
      name?: string;
      mappings?: ClientMapping[];
    } = {}
  ): RegisteredClient {
    // Clean up existing client with same ID
    if (this.clients.has(clientId)) {
      this.unregisterClient(this.clients.get(clientId)!.ws);
    }

    const client: RegisteredClient = {
      id: clientId,
      name: options.name || `Client-${clientId.slice(0, 8)}`,
      connected: true,
      lastHeartbeat: Date.now(),
      requestCount: 0,
      mappings: options.mappings || [],
      ws,
    };

    this.clients.set(clientId, client);
    
    // Логируем информацию о регистрации
    console.log(`📝 Client registered: ${client.name} (${clientId})`);
    
    if (client.mappings && client.mappings.length > 0) {
      console.log(`🗺️  Mappings registered for ${client.name}:`);
      client.mappings.forEach((mapping, index) => {
        console.log(`   ${index + 1}. /${mapping.prefix}/* -> ${mapping.target} (${mapping.description})`);
      });
    } else {
      console.log(`📁 Client ${client.name} using default mapping only`);
    }
    
    return client;
  }

  public unregisterClient(ws: WebSocket): void {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws === ws) {
        console.log(`📝 Client unregistered: ${client.name} (${clientId})`);
        client.connected = false;
        this.clients.delete(clientId);
        
        // Reject all pending requests for this client
        this.rejectRequestsForClient(clientId);
        break;
      }
    }
  }

  public getClient(clientId: string): RegisteredClient | undefined {
    return this.clients.get(clientId);
  }

  public getConnectedClients(): RegisteredClient[] {
    return Array.from(this.clients.values()).filter(c => c.connected);
  }

  public getAvailableClient(): RegisteredClient | null {
    const connectedClients = this.getConnectedClients();
    
    if (connectedClients.length === 0) {
      return null;
    }

    // Simple round-robin: return client with least requests
    return connectedClients.reduce((min, client) => 
      client.requestCount < min.requestCount ? client : min
    );
  }

  /**
   * Получить клиента, который поддерживает определенный мапинг
   */
  public getClientWithMapping(mappingPrefix: string): RegisteredClient | null {
    const connectedClients = this.getConnectedClients();
    
    // Ищем клиента с подходящим мапингом
    const clientsWithMapping = connectedClients.filter(client => 
      client.mappings && client.mappings.some(mapping => mapping.prefix === mappingPrefix)
    );
    
    if (clientsWithMapping.length === 0) {
      return null;
    }

    // Возвращаем клиента с наименьшим количеством запросов
    return clientsWithMapping.reduce((min, client) => 
      client.requestCount < min.requestCount ? client : min
    );
  }

  public updateHeartbeat(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastHeartbeat = Date.now();
    }
  }

  public checkHeartbeats(): void {
    const now = Date.now();
    const deadClients: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastHeartbeat > this.heartbeatTimeout) {
        console.warn(`💀 Client heartbeat timeout: ${client.name} (${clientId})`);
        deadClients.push(clientId);
      }
    }

    // Remove dead clients
    deadClients.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client) {
        this.unregisterClient(client.ws);
      }
    });
  }

  public addPendingRequest(
    requestId: string, 
    clientId: string,
    resolve: (value: HttpResponsePayload) => void, 
    reject: (error: Error) => void
  ): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.requestCount++;
    }

    const timeout = setTimeout(() => {
      this.rejectRequest(requestId, new Error('Request timeout'));
    }, this.requestTimeout);

    this.pendingRequests.set(requestId, {
      id: requestId,
      timestamp: Date.now(),
      resolve,
      reject,
      timeout,
    });
  }

  public resolveRequest(requestId: string, response: HttpResponsePayload): void {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(requestId);
      
      // Add duration to response
      response.duration = Date.now() - request.timestamp;
      request.resolve(response);
    }
  }

  public rejectRequest(requestId: string, error: Error): void {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(requestId);
      request.reject(error);
    }
  }

  private rejectRequestsForClient(clientId: string): void {
    // This is a simplified approach - in reality, you might want to track which requests belong to which client
    const pendingIds = Array.from(this.pendingRequests.keys());
    pendingIds.forEach(requestId => {
      this.rejectRequest(requestId, new Error('Client disconnected'));
    });
  }

  /**
   * Получить детальную информацию о мапингах всех клиентов
   */
  public getMappingInfo() {
    const mappingInfo: { [clientId: string]: ClientMapping[] } = {};
    
    this.clients.forEach((client, clientId) => {
      if (client.mappings && client.mappings.length > 0) {
        mappingInfo[clientId] = client.mappings;
      }
    });
    
    return mappingInfo;
  }

  /**
   * Получить список всех доступных префиксов мапингов
   */
  public getAvailableMappingPrefixes(): string[] {
    const prefixes = new Set<string>();
    
    this.getConnectedClients().forEach(client => {
      if (client.mappings) {
        client.mappings.forEach(mapping => {
          prefixes.add(mapping.prefix);
        });
      }
    });
    
    return Array.from(prefixes);
  }

  public getStats() {
    const mappingStats = this.getMappingInfo();
    const totalMappings = Object.values(mappingStats).reduce((sum, mappings) => sum + mappings.length, 0);
    
    return {
      totalClients: this.clients.size,
      connectedClients: this.getConnectedClients().length,
      pendingRequests: this.pendingRequests.size,
      totalMappings,
      availableMappingPrefixes: this.getAvailableMappingPrefixes(),
      clients: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        name: c.name,
        connected: c.connected,
        lastHeartbeat: c.lastHeartbeat,
        requestCount: c.requestCount,
        mappings: c.mappings || [],
      })),
      mappingDetails: mappingStats
    };
  }
}