// utils/service-locator.ts
import { NotificationService } from '../services/notification.service';
import { Logger } from './logger';

export class ServiceLocator {
  private static instance: ServiceLocator;
  private notificationService: NotificationService | null = null;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger('ServiceLocator');
  }

  public static getInstance(): ServiceLocator {
    if (!ServiceLocator.instance) {
      ServiceLocator.instance = new ServiceLocator();
    }
    return ServiceLocator.instance;
  }

  public static initialize(notificationService: NotificationService): void {
    const instance = ServiceLocator.getInstance();
    instance.notificationService = notificationService;
    instance.logger.info('ServiceLocator initialized with notification service');
  }

  public getNotificationService(): NotificationService {
    if (!this.notificationService) {
      throw new Error('NotificationService not initialized in ServiceLocator');
    }
    return this.notificationService;
  }
}