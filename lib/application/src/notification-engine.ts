import type {
  Notification,
  NotificationCategory,
  NotificationRepository,
} from '@workspace/domain';

export type NotificationEngine = {
  createNotification(notification: Notification): Promise<void>;
  markRead(input: {
    clubId: string;
    notificationId: string;
    readAt: string;
  }): Promise<void>;
  markDelivered(input: {
    clubId: string;
    notificationId: string;
    deliveredAt: string;
  }): Promise<void>;
  archiveNotification(input: {
    clubId: string;
    notificationId: string;
    archivedAt: string;
  }): Promise<void>;
};

export function createNotificationEngine(
  repository: NotificationRepository,
): NotificationEngine {
  return {
    createNotification: (notification) => repository.save(notification),
    markRead: (input) =>
      repository.markRead(input.clubId, input.notificationId, input.readAt),
    markDelivered: async (input) => {
      if (!repository.markDelivered) throw new Error('NOTIFICATION_DELIVERY_UNSUPPORTED');
      await repository.markDelivered(
        input.clubId,
        input.notificationId,
        input.deliveredAt,
      );
    },
    archiveNotification: async (input) => {
      if (!repository.archive) throw new Error('NOTIFICATION_ARCHIVE_UNSUPPORTED');
      await repository.archive(
        input.clubId,
        input.notificationId,
        input.archivedAt,
      );
    },
  };
}

export function notificationCategoryFor(
  category: NotificationCategory,
): NotificationCategory {
  return category;
}