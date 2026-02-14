import { Server } from 'http';
import { WebSocketUtil } from './websocket.util';
import { Logger } from './logger';

class WebSocketManager {
  private static instance: WebSocketManager;
  private _wss: WebSocketUtil | null = null;
  private logger: Logger;
  private server: Server | null = null;
  private initPromise: Promise<WebSocketUtil> | null = null;

  private constructor() {
    this.logger = new Logger('WebSocketManager');
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  public initialize(server: Server): WebSocketUtil {
    if (!this._wss) {
      this.server = server;
      this._wss = new WebSocketUtil(server);
      this.logger.info('WebSocketManager: WebSocket server initialized');
      
      // Store the WebSocket instance
      (global as any).__webSocketInstance = this._wss;
    }
    return this._wss;
  }

  public getWebSocket(): WebSocketUtil | null {
    if (!this._wss) {
      // Try to get from global
      if ((global as any).__webSocketInstance) {
        this._wss = (global as any).__webSocketInstance;
        this.logger.info('WebSocketManager: Retrieved WebSocket from global');
      } else {
        this.logger.warn('WebSocketManager: WebSocket not initialized yet');
      }
    }
    return this._wss;
  }

  public async waitForWebSocket(timeoutMs: number = 10000): Promise<WebSocketUtil> {
    // If already initialized, return it with type assertion
    if (this._wss) {
      return this._wss as WebSocketUtil; // Type assertion here
    }

    const startTime = Date.now();
    
    while (!this._wss && Date.now() - startTime < timeoutMs) {
      // Check global
      if ((global as any).__webSocketInstance) {
        this._wss = (global as any).__webSocketInstance;
        this.logger.info('WebSocketManager: Found WebSocket in global after wait');
        return this._wss as WebSocketUtil; // Type assertion here
      }
      
      this.logger.debug('WebSocketManager: Waiting for WebSocket initialization...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // If we get here and still no WebSocket, throw error
    if (!this._wss) {
      throw new Error(`WebSocket not available after ${timeoutMs}ms`);
    }
    
    // Type assertion for the final return
    return this._wss as WebSocketUtil;
  }

  public isInitialized(): boolean {
    return this._wss !== null || (global as any).__webSocketInstance !== undefined;
  }
}

export const webSocketManager = WebSocketManager.getInstance();