// Updated logger.ts - Fix Winston type issue
import winston, { Logger as WinstonLogger } from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Logger class for better OOP usage
export class Logger {
  private logger: WinstonLogger;
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
    
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      format: logFormat,
      defaultMeta: { service: 'order-service', context },
      transports: [
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
        }),
      ],
    });

    if (process.env.NODE_ENV === 'development') {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        })
      );
    }
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  error(message: string, error?: any) {
    const errorMessage = error instanceof Error ? error.message : error;
    this.logger.error(message, { error: errorMessage });
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }

  http(message: string, meta?: any) {
    // Check if http method exists, fallback to info if not
    if ((this.logger as any).http) {
      (this.logger as any).http(message, meta);
    } else {
      this.logger.info(`[HTTP] ${message}`, meta);
    }
  }
}

// Keep the default instance for backward compatibility
export const defaultLogger = new Logger('App');

// Export for direct use
export default defaultLogger;