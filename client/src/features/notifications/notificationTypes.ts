export type NotificationType = "mention" | "owner" | "progress" | "comment";

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  contextLabel?: string;
  contextId?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  contextLabel: string;
  contextId?: string;
  type: NotificationType;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
}
