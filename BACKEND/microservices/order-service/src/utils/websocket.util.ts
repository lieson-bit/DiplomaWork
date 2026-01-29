import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { Logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  messageId?: string;
}

export interface WebSocketConnection {
  connectionId: string;
  userId: string;
  userType: 'customer' | 'driver' | 'admin';
  socket: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
  metadata?: any;
}

export interface WebSocketEvent {
  type: 'connect' | 'disconnect' | 'message' | 'error';
  connectionId: string;
  userId: string;
  data?: any;
  timestamp: Date;
}

export interface WebSocketConfig {
  port?: number;
  path?: string;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  maxConnections?: number;
  enableCompression?: boolean;
}

export class WebSocketUtil {
  private logger: Logger;
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> connectionIds
  private eventListeners: Map<string, Function[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: WebSocketConfig;

  constructor(config: WebSocketConfig = {}) {
    this.logger = new Logger('WebSocketUtil');
    this.config = {
      port: parseInt(process.env.WS_PORT || '8081'),
      path: '/ws',
      heartbeatInterval: 30000, // 30 seconds
      connectionTimeout: 300000, // 5 minutes
      maxConnections: 10000,
      enableCompression: true,
      ...config
    };
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server?: Server): void {
    try {
      if (this.wss) {
        this.logger.warn('WebSocket server already initialized');
        return;
      }

      const options: any = {
        clientTracking: true,
        ...(this.config.enableCompression && { perMessageDeflate: true })
      };

      if (server) {
        options.server = server;
        this.wss = new WebSocketServer(options);
        this.logger.info(`WebSocket server initialized on path ${this.config.path}`);
      } else {
        options.port = this.config.port;
        this.wss = new WebSocketServer(options);
        this.logger.info(`WebSocket server initialized on port ${this.config.port}`);
      }

      this.setupEventHandlers();
      this.startHeartbeat();
      
      this.logger.info('WebSocket server ready');
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    try {
      this.logger.info('Shutting down WebSocket server');
      
      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      
      // Close all connections
      this.connections.forEach(connection => {
        try {
          connection.socket.close(1001, 'Server shutdown');
        } catch (error) {
          // Ignore errors during shutdown
        }
      });
      
      this.connections.clear();
      this.userConnections.clear();
      
      // Close server
      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }
      
      this.logger.info('WebSocket server shutdown complete');
    } catch (error) {
      this.logger.error('Error during WebSocket shutdown:', error);
    }
  }

  /**
   * Send message to specific connection
   */
  async sendToConnection(
    connectionId: string,
    type: string,
    payload: any
  ): Promise<boolean> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        this.logger.warn(`Connection ${connectionId} not found`);
        return false;
      }

      if (connection.socket.readyState !== WebSocket.OPEN) {
        this.logger.warn(`Connection ${connectionId} is not open (state: ${connection.socket.readyState})`);
        return false;
      }

      const message: WebSocketMessage = {
        type,
        payload,
        timestamp: Date.now(),
        messageId: uuidv4()
      };

      connection.socket.send(JSON.stringify(message));
      connection.lastActivity = new Date();
      
      this.logger.debug(`Sent message to connection ${connectionId}: ${type}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to connection ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Send message to specific user
   */
  async sendToUser(
    userId: string,
    type: string,
    payload: any
  ): Promise<boolean> {
    try {
      const connectionIds = this.userConnections.get(userId);
      if (!connectionIds || connectionIds.size === 0) {
        this.logger.debug(`No active connections for user ${userId}`);
        return false;
      }

      let successCount = 0;
      for (const connectionId of connectionIds) {
        const success = await this.sendToConnection(connectionId, type, payload);
        if (success) successCount++;
      }

      this.logger.debug(`Sent message to ${successCount}/${connectionIds.size} connections for user ${userId}`);
      return successCount > 0;
    } catch (error) {
      this.logger.error(`Failed to send message to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send message to all users of a specific type
   */
  async sendToUserType(
    userType: 'customer' | 'driver' | 'admin',
    type: string,
    payload: any
  ): Promise<number> {
    try {
      let successCount = 0;
      let totalCount = 0;

      this.connections.forEach(connection => {
        if (connection.userType === userType) {
          totalCount++;
          const success = this.sendToConnection(connection.connectionId, type, payload);
          if (success) successCount++;
        }
      });

      this.logger.debug(`Sent message to ${successCount}/${totalCount} ${userType} users`);
      return successCount;
    } catch (error) {
      this.logger.error(`Failed to send message to user type ${userType}:`, error);
      return 0;
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  async broadcast(type: string, payload: any, excludeConnectionId?: string): Promise<number> {
    try {
      let successCount = 0;
      let totalCount = 0;

      this.connections.forEach(connection => {
        if (!excludeConnectionId || connection.connectionId !== excludeConnectionId) {
          totalCount++;
          const success = this.sendToConnection(connection.connectionId, type, payload);
          if (success) successCount++;
        }
      });

      this.logger.debug(`Broadcasted message to ${successCount}/${totalCount} connections`);
      return successCount;
    } catch (error) {
      this.logger.error('Failed to broadcast message:', error);
      return 0;
    }
  }

  /**
   * Get connection information
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): WebSocketConnection[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) {
      return [];
    }

    const connections: WebSocketConnection[] = [];
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connections.push(connection);
      }
    }

    return connections;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    totalUsers: number;
    byUserType: Record<string, number>;
    uptime?: number;
  } {
    const byUserType: Record<string, number> = {
      customer: 0,
      driver: 0,
      admin: 0
    };

    this.connections.forEach(connection => {
      byUserType[connection.userType] = (byUserType[connection.userType] || 0) + 1;
    });

    return {
      totalConnections: this.connections.size,
      totalUsers: this.userConnections.size,
      byUserType
    };
  }

  /**
   * Disconnect a specific connection
   */
  disconnect(connectionId: string, code: number = 1000, reason: string = 'Disconnected by server'): boolean {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        return false;
      }

      connection.socket.close(code, reason);
      this.removeConnection(connectionId);
      
      this.logger.info(`Disconnected connection ${connectionId} (${code}: ${reason})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to disconnect connection ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Disconnect all connections for a user
   */
  disconnectUser(userId: string, code: number = 1000, reason: string = 'Disconnected by server'): number {
    try {
      const connectionIds = this.userConnections.get(userId);
      if (!connectionIds) {
        return 0;
      }

      let disconnectedCount = 0;
      for (const connectionId of connectionIds) {
        const success = this.disconnect(connectionId, code, reason);
        if (success) disconnectedCount++;
      }

      this.logger.info(`Disconnected ${disconnectedCount} connections for user ${userId}`);
      return disconnectedCount;
    } catch (error) {
      this.logger.error(`Failed to disconnect user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Add event listener
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (socket: WebSocket, request: any) => {
      this.handleConnection(socket, request);
    });

    this.wss.on('error', (error: Error) => {
      this.logger.error('WebSocket server error:', error);
      this.emitEvent('error', {
        type: 'server_error',
        error: error.message
      });
    });

    this.wss.on('close', () => {
      this.logger.info('WebSocket server closed');
      this.emitEvent('server_close', {});
    });
  }

  private handleConnection(socket: WebSocket, request: any): void {
    const connectionId = uuidv4();
    const url = new URL(request.url, `http://${request.headers.host}`);
    const params = url.searchParams;

    // Extract user info from query parameters or headers
    const userId = params.get('userId') || request.headers['x-user-id'] || 'anonymous';
    const userType = (params.get('userType') || request.headers['x-user-type'] || 'customer') as 'customer' | 'driver' | 'admin';

    const connection: WebSocketConnection = {
      connectionId,
      userId,
      userType,
      socket,
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        ip: request.socket.remoteAddress,
        userAgent: request.headers['user-agent'],
        queryParams: Object.fromEntries(params.entries())
      }
    };

    // Check max connections
    if (this.connections.size >= (this.config.maxConnections || 10000)) {
      this.logger.warn(`Maximum connections (${this.config.maxConnections}) reached, rejecting new connection`);
      socket.close(1013, 'Too many connections');
      return;
    }

    // Store connection
    this.connections.set(connectionId, connection);

    // Update user connections mapping
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // Set up socket event handlers
    socket.on('message', (data: WebSocket.Data) => {
      this.handleMessage(connectionId, data);
    });

    socket.on('close', (code: number, reason: Buffer) => {
      this.handleClose(connectionId, code, reason.toString());
    });

    socket.on('error', (error: Error) => {
      this.handleError(connectionId, error);
    });

    socket.on('pong', () => {
      this.handlePong(connectionId);
    });

    // Send welcome message
    const welcomeMessage: WebSocketMessage = {
      type: 'welcome',
      payload: {
        connectionId,
        userId,
        userType,
        serverTime: new Date().toISOString(),
        stats: this.getStats()
      },
      timestamp: Date.now()
    };

    socket.send(JSON.stringify(welcomeMessage));

    // Emit connection event
    this.emitEvent('connect', {
      connectionId,
      userId,
      userType,
      metadata: connection.metadata
    });

    this.logger.info(`New WebSocket connection: ${connectionId} (user: ${userId}, type: ${userType})`);
  }

  private handleMessage(connectionId: string, data: WebSocket.Data): void {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      connection.lastActivity = new Date();

      let message: WebSocketMessage;
      if (typeof data === 'string') {
        message = JSON.parse(data);
      } else if (data instanceof Buffer) {
        message = JSON.parse(data.toString());
      } else {
        this.logger.warn(`Unsupported message format from connection ${connectionId}`);
        return;
      }

      // Validate message structure
      if (!message.type || typeof message.type !== 'string') {
        this.logger.warn(`Invalid message from connection ${connectionId}: missing type`);
        this.sendToConnection(connectionId, 'error', {
          message: 'Invalid message format: type is required',
          originalMessage: message
        });
        return;
      }

      // Update timestamp if not provided
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }

      // Emit message event
      this.emitEvent('message', {
        connectionId,
        userId: connection.userId,
        userType: connection.userType,
        message
      });

      // Handle specific message types
      this.handleMessageType(connection, message);

      this.logger.debug(`Received message from ${connectionId}: ${message.type}`);
    } catch (error) {
      this.logger.error(`Error handling message from connection ${connectionId}:`, error);
      this.sendToConnection(connectionId, 'error', {
        message: 'Failed to process message',
        error: error.message
      });
    }
  }

  private handleMessageType(connection: WebSocketConnection, message: WebSocketMessage): void {
    switch (message.type) {
      case 'ping':
        this.sendToConnection(connection.connectionId, 'pong', {
          timestamp: Date.now(),
          serverTime: new Date().toISOString()
        });
        break;

      case 'subscribe':
        // Handle subscription requests
        this.handleSubscribe(connection, message.payload);
        break;

      case 'unsubscribe':
        // Handle unsubscription requests
        this.handleUnsubscribe(connection, message.payload);
        break;

      case 'auth':
        // Handle authentication
        this.handleAuth(connection, message.payload);
        break;

      default:
        // Custom message types are handled by event listeners
        break;
    }
  }

  private handleSubscribe(connection: WebSocketConnection, payload: any): void {
    // In a real implementation, you would manage subscriptions for topics/channels
    const { topics } = payload;
    
    if (!topics || !Array.isArray(topics)) {
      this.sendToConnection(connection.connectionId, 'error', {
        message: 'Invalid subscription request: topics array required'
      });
      return;
    }

    // Store subscriptions in connection metadata
    if (!connection.metadata) {
      connection.metadata = {};
    }
    if (!connection.metadata.subscriptions) {
      connection.metadata.subscriptions = new Set();
    }

    topics.forEach((topic: string) => {
      connection.metadata.subscriptions.add(topic);
    });

    this.sendToConnection(connection.connectionId, 'subscribed', {
      topics,
      timestamp: new Date().toISOString()
    });
  }

  private handleUnsubscribe(connection: WebSocketConnection, payload: any): void {
    const { topics } = payload;
    
    if (!topics || !Array.isArray(topics)) {
      this.sendToConnection(connection.connectionId, 'error', {
        message: 'Invalid unsubscription request: topics array required'
      });
      return;
    }

    if (!connection.metadata?.subscriptions) {
      this.sendToConnection(connection.connectionId, 'error', {
        message: 'No active subscriptions'
      });
      return;
    }

    topics.forEach((topic: string) => {
      connection.metadata.subscriptions.delete(topic);
    });

    this.sendToConnection(connection.connectionId, 'unsubscribed', {
      topics,
      timestamp: new Date().toISOString()
    });
  }

  private handleAuth(connection: WebSocketConnection, payload: any): void {
    // In a real implementation, you would validate tokens and update user info
    const { token, userId, userType } = payload;
    
    if (!token) {
      this.sendToConnection(connection.connectionId, 'auth_error', {
        message: 'Authentication token required'
      });
      return;
    }

    // Validate token (placeholder implementation)
    const isValid = this.validateToken(token);
    
    if (!isValid) {
      this.sendToConnection(connection.connectionId, 'auth_error', {
        message: 'Invalid authentication token'
      });
      return;
    }

    // Update connection info
    const oldUserId = connection.userId;
    connection.userId = userId || connection.userId;
    connection.userType = userType || connection.userType;

    // Update user connections mapping
    if (oldUserId !== connection.userId) {
      // Remove from old user's connections
      const oldUserConnections = this.userConnections.get(oldUserId);
      if (oldUserConnections) {
        oldUserConnections.delete(connection.connectionId);
        if (oldUserConnections.size === 0) {
          this.userConnections.delete(oldUserId);
        }
      }

      // Add to new user's connections
      if (!this.userConnections.has(connection.userId)) {
        this.userConnections.set(connection.userId, new Set());
      }
      this.userConnections.get(connection.userId)!.add(connection.connectionId);
    }

    this.sendToConnection(connection.connectionId, 'authenticated', {
      userId: connection.userId,
      userType: connection.userType,
      timestamp: new Date().toISOString()
    });

    this.logger.info(`Connection ${connection.connectionId} authenticated as ${connection.userId} (${connection.userType})`);
  }

  private validateToken(token: string): boolean {
    // Placeholder implementation
    // In production, you would validate JWT or other tokens
    return token.length > 10;
  }

  private handleClose(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove connection
    this.removeConnection(connectionId);

    // Emit disconnect event
    this.emitEvent('disconnect', {
      connectionId,
      userId: connection.userId,
      userType: connection.userType,
      code,
      reason,
      duration: Date.now() - connection.connectedAt.getTime()
    });

    this.logger.info(`WebSocket connection closed: ${connectionId} (${code}: ${reason})`);
  }

  private handleError(connectionId: string, error: Error): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.emitEvent('error', {
      type: 'connection_error',
      connectionId,
      userId: connection.userId,
      error: error.message
    });

    this.logger.error(`WebSocket connection error (${connectionId}):`, error);
  }

  private handlePong(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user connections mapping
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Remove from connections map
    this.connections.delete(connectionId);
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private performHeartbeat(): void {
    const now = new Date();
    const timeout = this.config.connectionTimeout || 300000; // 5 minutes

    this.connections.forEach(connection => {
      const idleTime = now.getTime() - connection.lastActivity.getTime();
      
      if (idleTime > timeout) {
        this.logger.warn(`Connection ${connection.connectionId} idle for ${idleTime}ms, closing`);
        this.disconnect(connection.connectionId, 1001, 'Connection timeout');
      } else if (connection.socket.readyState === WebSocket.OPEN) {
        // Send ping to check connection
        try {
          connection.socket.ping();
        } catch (error) {
          this.logger.warn(`Failed to ping connection ${connection.connectionId}:`, error);
        }
      }
    });
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    const eventData: WebSocketEvent = {
      type: event as any,
      ...data,
      timestamp: new Date()
    };

    listeners.forEach(listener => {
      try {
        listener(eventData);
      } catch (error) {
        this.logger.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
}

// Singleton instance
export const webSocketUtil = new WebSocketUtil();