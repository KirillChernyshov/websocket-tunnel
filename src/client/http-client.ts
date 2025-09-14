import fetch, { Response } from 'node-fetch';

// AbortController polyfill for older Node.js versions
if (!globalThis.AbortController) {
  try {
    const util = require('util');
    globalThis.AbortController = util.AbortController;
  } catch (error) {
    // For very old Node.js versions or environments without AbortController
    console.warn('AbortController not available, fetch requests will not have timeout');
  }
}
import { HttpRequestPayload, HttpResponsePayload } from '../shared/types';

export class HttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  public async makeRequest(payload: HttpRequestPayload): Promise<HttpResponsePayload> {
    const url = this.buildUrl(payload.path, payload.query);
    
    console.log(`🌐 Making ${payload.method} request to: ${url}`);

    try {
      // Create AbortController for timeout if available
      let controller: AbortController | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      
      if (globalThis.AbortController) {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller!.abort(), 30000);
      }

      const response = await fetch(url, {
        method: payload.method,
        headers: this.sanitizeHeaders(payload.headers),
        body: this.prepareBody(payload),
        ...(controller && { signal: controller.signal }),
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return await this.processResponse(response);
      
    } catch (error) {
      console.error('❌ HTTP request failed:', error);
      
      // Return error response
      return {
        statusCode: 503,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Service Unavailable',
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'HTTP_REQUEST_FAILED'
        }),
      };
    }
  }

  private buildUrl(path: string, query?: Record<string, any>): string {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${this.baseUrl}${normalizedPath}`;
    
    // Add query parameters
    if (query && Object.keys(query).length > 0) {
      const searchParams = new URLSearchParams();
      
      Object.entries(query).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else {
          searchParams.append(key, String(value));
        }
      });
      
      url += `?${searchParams.toString()}`;
    }
    
    return url;
  }

  private prepareBody(payload: HttpRequestPayload): string | undefined {
    if (!payload.body) {
      return undefined;
    }

    const method = payload.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'DELETE') {
      return undefined;
    }

    return payload.body;
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    // Headers that should not be forwarded to local requests
    const skipHeaders = [
      'host',
      'connection',
      'upgrade',
      'transfer-encoding',
      'content-length', // Let fetch calculate this
    ];

    Object.entries(headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (!skipHeaders.includes(lowerKey) && value !== undefined) {
        sanitized[key] = String(value);
      }
    });

    return sanitized;
  }

  private async processResponse(response: Response): Promise<HttpResponsePayload> {
    // Get response body
    let body: string;
    try {
      body = await response.text();
    } catch (error) {
      console.error('❌ Failed to read response body:', error);
      body = '';
    }

    // Convert headers to plain object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      statusCode: response.status,
      headers,
      body,
    };
  }

  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }
}
