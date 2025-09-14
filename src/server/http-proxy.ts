import { ClientManager } from './client-manager';
import { HttpRequestPayload, HttpResponsePayload } from '../shared/types';

interface RouteInfo {
  clientId?: string;
  targetPath: string;
  routeType: 'specific' | 'balanced';
}

export class HttpProxyHandler {
  private clientManager: ClientManager;
  private requestTimeout: number;

  constructor(clientManager: ClientManager, requestTimeout: number = 30000) {
    this.clientManager = clientManager;
    this.requestTimeout = requestTimeout;
  }

  /**
   * Parse the incoming request path to determine routing strategy
   * Routes:
   * - /client/{clientId}/* -> route to specific client
   * - /api/* -> balanced routing across all clients  
   * - /* -> balanced routing (default)
   */
  private parseRoute(path: string): RouteInfo {
    // Match /client/{clientId}/...
    const clientRouteMatch = path.match(/^\/client\/([^\/]+)(\/.*)?$/);
    
    if (clientRouteMatch) {
      const clientId = clientRouteMatch[1];
      const targetPath = clientRouteMatch[2] || '/';
      
      return {
        clientId,
        targetPath,
        routeType: 'specific'
      };
    }

    // For /api/* or any other path, use balanced routing
    return {
      targetPath: path,
      routeType: 'balanced'
    };
  }

  public async handleRequest(request: {
    id: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: string;
    query?: Record<string, any>;
  }): Promise<HttpResponsePayload> {
    
    const route = this.parseRoute(request.path);
    let client;

    if (route.routeType === 'specific') {
      // Route to specific client
      client = this.clientManager.getClient(route.clientId!);
      
      if (!client) {
        throw new Error(`Client '${route.clientId}' not found`);
      }
      
      if (!client.connected) {
        throw new Error(`Client '${route.clientId}' (${client.name}) is not connected`);
      }

      console.log(`🎯 Routing request ${request.id} to specific client ${client.name} (${client.id})`);
    } else {
      // Balanced routing across all clients
      client = this.clientManager.getAvailableClient();
      
      if (!client) {
        throw new Error('No connected clients available');
      }

      console.log(`🔄 Routing request ${request.id} to balanced client ${client.name} (${client.id})`);
    }

    // Prepare the request payload with the target path
    const requestPayload: HttpRequestPayload = {
      method: request.method,
      path: route.targetPath, // Use the parsed target path
      headers: this.sanitizeHeaders(request.headers),
      body: request.body,
      query: request.query || {},
    };

    // Create a promise that will be resolved when we get the response
    return new Promise<HttpResponsePayload>((resolve, reject) => {
      // Add to pending requests
      this.clientManager.addPendingRequest(request.id, client.id, resolve, reject);

      // Send the request through WebSocket
      const success = this.sendRequestToClient(client.id, request.id, requestPayload);
      
      if (!success) {
        this.clientManager.rejectRequest(request.id, new Error('Failed to send request to client'));
      }
    });
  }

  /**
   * Send request to specific client by ID
   */
  public async handleRequestToClient(
    clientId: string,
    request: {
      id: string;
      method: string;
      path: string;
      headers: Record<string, string>;
      body?: string;
      query?: Record<string, any>;
    }
  ): Promise<HttpResponsePayload> {
    
    const client = this.clientManager.getClient(clientId);
    if (!client) {
      throw new Error(`Client '${clientId}' not found`);
    }
    
    if (!client.connected) {
      throw new Error(`Client '${clientId}' (${client.name}) is not connected`);
    }

    console.log(`🎯 Direct request ${request.id} to client ${client.name} (${client.id})`);

    const requestPayload: HttpRequestPayload = {
      method: request.method,
      path: request.path,
      headers: this.sanitizeHeaders(request.headers),
      body: request.body,
      query: request.query || {},
    };

    return new Promise<HttpResponsePayload>((resolve, reject) => {
      this.clientManager.addPendingRequest(request.id, client.id, resolve, reject);

      const success = this.sendRequestToClient(client.id, request.id, requestPayload);
      
      if (!success) {
        this.clientManager.rejectRequest(request.id, new Error('Failed to send request to client'));
      }
    });
  }

  private sendRequestToClient(clientId: string, requestId: string, payload: HttpRequestPayload): boolean {
    const client = this.clientManager.getClient(clientId);
    if (!client || !client.connected) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify({
        id: requestId,
        type: 'request',
        timestamp: Date.now(),
        clientId,
        payload,
      }));
      return true;
    } catch (error) {
      console.error(`Failed to send request to client ${clientId}:`, error);
      return false;
    }
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    // Remove headers that shouldn't be forwarded
    const skipHeaders = [
      'host',
      'connection',
      'upgrade',
      'sec-websocket-key',
      'sec-websocket-version',
      'sec-websocket-extensions',
      'x-forwarded-for',
      'x-forwarded-proto',
      'x-forwarded-host',
    ];

    Object.entries(headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (!skipHeaders.includes(lowerKey) && value !== undefined) {
        sanitized[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    });

    return sanitized;
  }

  /**
   * Get routing information for a path
   */
  public getRouteInfo(path: string): RouteInfo {
    return this.parseRoute(path);
  }

  public getStats() {
    return {
      requestTimeout: this.requestTimeout,
      clientStats: this.clientManager.getStats(),
      supportedRoutes: [
        '/client/{clientId}/* - Route to specific client',
        '/api/* - Balanced routing across all clients',
        '/* - Default balanced routing'
      ]
    };
  }
}