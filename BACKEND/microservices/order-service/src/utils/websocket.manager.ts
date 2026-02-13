// utils/websocket.manager.ts
import { Server } from 'http';
import { WebSocketUtil } from './websocket.util';
import { Logger } from './logger';

class WebSocketManager {
  private static instance: WebSocketManager;
  private _wss: WebSocketUtil | null = null;
  private logger: Logger;
  private server: Server | null = null;

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
    }
    return this._wss;
  }

  public getWebSocket(): WebSocketUtil {
    if (!this._wss) {
      this.logger.warn('WebSocketManager: WebSocket not initialized yet, returning null');
      return null as any; // This will be caught by the services
    }
    return this._wss;
  }

  public isInitialized(): boolean {
    return this._wss !== null;
  }
}

export const webSocketManager = WebSocketManager.getInstance();