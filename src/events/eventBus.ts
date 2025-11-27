import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface NotificationEvent {
  userId: string;
  type: string;
  metadata?: Record<string, any>;
  priority?: 'IMMEDIATE' | 'HIGH' | 'LOW';
}

class TypedEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitNotification(event: NotificationEvent): boolean {
    logger.info('Event bus: emitting notification event', {
      userId: event.userId,
      type: event.type,
      priority: event.priority || 'LOW',
    });
    return this.emit('notify', event);
  }

  onNotification(handler: (event: NotificationEvent) => Promise<void> | void): this {
    return this.on('notify', handler);
  }
}

export const eventBus = new TypedEventBus();
