import { ClientManager } from './client-manager';
import { HttpRequestPayload, HttpResponsePayload } from '../shared/types';

export class HttpProxyHandler {
  private clientManager: ClientManager;
  private requestTimeout: number;

  constructor(clientManager: ClientManager, requestTimeout: number = 30000) {
    this.clientManager = clientManager;
    this.requestTimeout = requestTimeout;
  }

  public async handleRequest(request: {
    id: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: string;
    query?: Record<string, any>;
  }): Promise<HttpResponsePayload> {
    
    // Find an available client
    const client = this.clientManager.getAvailableClient();
    if (!client) {
      throw new Error('No connected clients available');
    }

    console.log(`🔄 Routing request ${request.id} to client ${client.name} (${client.id})`);

    // Prepare the request payload
    const requestPayload: HttpRequestPayload = {
      method: request.method,
      path: request.path,
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

  public getStats() {
    return {
      requestTimeout: this.requestTimeout,
      clientStats: this.clientManager.getStats(),
    };
  }
}
