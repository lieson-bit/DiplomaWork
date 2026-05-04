/*import { Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { Logger } from './logger';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export class WebSocketUtil {
  private wss: WebSocketServer;
  private logger: Logger;
  private connections: Map<string, WebSocket> = new Map(); // connectionId -> WebSocket
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> connectionIds

  constructor(server?: Server) {
    this.logger = new Logger('WebSocketUtil');
    
    // FIXED: Handle both cases - with server or without
    if (server) {
      this.wss = new WebSocketServer({ 
        server, 
        path: '/ws',
        perMessageDeflate: false
      });
      this.logger.info('WebSocket server initialized with HTTP server');
    } else {
      // Create standalone WebSocket server on separate port
      const WEBSOCKET_PORT = parseInt(process.env.WEBSOCKET_PORT || '8080');
      this.wss = new WebSocketServer({ 
        port: WEBSOCKET_PORT,
        path: '/ws',
        perMessageDeflate: false
      });
      this.logger.info(`WebSocket server initialized on standalone port ${WEBSOCKET_PORT}`);
    }
    
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const connectionId = this.generateConnectionId();
      
      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          this.handleMessage(connectionId, ws, parsed);
        } catch (error) {
          this.logger.error('Failed to parse WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnection(connectionId);
      });

      ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        this.handleDisconnection(connectionId);
      });

      // Send connection established message
      ws.send(JSON.stringify({
        type: 'connection_established',
        data: { connectionId },
        timestamp: Date.now()
      }));
    });

    this.logger.info('WebSocket server ready for connections');
  }

  private handleMessage(connectionId: string, ws: WebSocket, message: WebSocketMessage): void {
    const { type, data } = message;

    switch (type) {
      case 'authenticate':
        this.handleAuthentication(connectionId, ws, data);
        break;
      case 'subscribe':
        this.handleSubscription(connectionId, data);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(connectionId, data);
        break;
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          data: {},
          timestamp: Date.now()
        }));
        break;
      default:
        this.logger.warn(`Unknown WebSocket message type: ${type}`);
    }
  }

  private handleAuthentication(connectionId: string, ws: WebSocket, data: any): void {
    const { userId, token } = data;
    
    if (!userId) {
      ws.send(JSON.stringify({
        type: 'auth_error',
        data: { error: 'User ID is required' },
        timestamp: Date.now()
      }));
      return;
    }

    // In production, validate the token here
    this.connections.set(connectionId, ws);
    
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    ws.send(JSON.stringify({
      type: 'authenticated',
      data: { userId, connectionId },
      timestamp: Date.now()
    }));

    this.logger.debug(`User ${userId} authenticated with connection ${connectionId}`);
  }

  private handleSubscription(connectionId: string, data: any): void {
    const { channel, orderId } = data;
    this.logger.debug(`Connection ${connectionId} subscribed to ${channel}:${orderId}`);
  }

  private handleUnsubscription(connectionId: string, data: any): void {
    const { channel, orderId } = data;
    this.logger.debug(`Connection ${connectionId} unsubscribed from ${channel}:${orderId}`);
  }

  private handleDisconnection(connectionId: string): void {
    // Remove from connections
    this.connections.delete(connectionId);
    
    // Remove from user connections
    for (const [userId, connections] of this.userConnections.entries()) {
      connections.delete(connectionId);
      if (connections.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    this.logger.debug(`Connection ${connectionId} disconnected`);
  }

  // Send message to specific user
  async sendToUser(userId: string, type: string, data: any): Promise<void> {
    const userConnections = this.userConnections.get(userId);
    
    if (!userConnections || userConnections.size === 0) {
      return; // User is not connected
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: Date.now()
    };

    const messageStr = JSON.stringify(message);
    
    for (const connectionId of userConnections) {
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          this.logger.error(`Failed to send message to user ${userId}:`, error);
          // Remove broken connection
          userConnections.delete(connectionId);
          this.connections.delete(connectionId);
        }
      }
    }
  }

  async close(): Promise<void> {
  return new Promise((resolve) => {
    this.logger.info('Closing WebSocket server...');
    
    // Close all connections
    for (const [connectionId, ws] of this.connections.entries()) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Server shutting down');
        }
      } catch (error) {
        this.logger.error(`Error closing connection ${connectionId}:`, error);
      }
    }
    
    // Clear all maps
    this.connections.clear();
    this.userConnections.clear();
    
    // Close the WebSocket server
    this.wss.close((err) => {
      if (err) {
        this.logger.error('Error closing WebSocket server:', err);
      } else {
        this.logger.info('WebSocket server closed successfully');
      }
      resolve();
    });
  });
}

  // Send message to specific connection
  async sendToConnection(connectionId: string, type: string, data: any): Promise<void> {
    const ws = this.connections.get(connectionId);
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: Date.now()
    };

    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error(`Failed to send message to connection ${connectionId}:`, error);
      this.handleDisconnection(connectionId);
    }
  }

  // Broadcast to all connected users
  broadcast(type: string, data: any): void {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: Date.now()
    };

    const messageStr = JSON.stringify(message);
    
    for (const [connectionId, ws] of this.connections.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          this.logger.error(`Failed to broadcast to connection ${connectionId}:`, error);
          this.handleDisconnection(connectionId);
        }
      }
    }
  }

  // Get connection statistics
  getStats(): {
    totalConnections: number;
    totalUsers: number;
    users: { userId: string; connectionCount: number }[];
  } {
    const users = Array.from(this.userConnections.entries()).map(([userId, connections]) => ({
      userId,
      connectionCount: connections.size
    }));

    return {
      totalConnections: this.connections.size,
      totalUsers: this.userConnections.size,
      users
    };
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}


// FIXED: Remove the singleton export or make it conditional
// Don't automatically create an instance
// export const webSocketUtil = new WebSocketUtil();*/