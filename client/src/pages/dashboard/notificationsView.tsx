import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { NotificationItem, NotificationType } from "@/features/notifications/notificationTypes";
import { logInfo } from "@/utils/logger";

interface NotificationsViewProps {
  notifications: NotificationItem[];
  onOpenNotification: (notification: NotificationItem) => void;
  onMarkRead: (notificationIds: string[]) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

const filterOptions: Array<{ id: "all" | NotificationType; label: string }> = [
  { id: "all", label: "All" },
  { id: "mention", label: "Mentions" },
  { id: "owner", label: "Owner Changes" },
  { id: "progress", label: "Progress" },
  { id: "comment", label: "Comments" }
];

export default function NotificationsView({
  notifications,
  onOpenNotification,
  onMarkRead,
  isLoading = false,
  errorMessage = null
}: NotificationsViewProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | NotificationType>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") {
      return notifications;
    }
    return notifications.filter((item) => item.type === activeFilter);
  }, [activeFilter, notifications]);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter((item) => !item.isRead).map((item) => item.id);
    if (!unreadIds.length) {
      return;
    }
    onMarkRead(unreadIds);
    setSelectedIds([]);
  };

  const handleMarkSelectedRead = () => {
    if (!selectedIds.length) {
      return;
    }
    onMarkRead(selectedIds);
    setSelectedIds([]);
  };

  return (
    <section className="pageSection">
      <div className="sectionHeader">
        <div>
          <h1>Notifications</h1>
          <p className="muted">Stay on top of updates across teams and OKRs.</p>
        </div>
        <div className="sectionActions">
          <Button variant="secondary" type="button" onClick={handleMarkSelectedRead}>
            Mark Selected Read
          </Button>
          <Button type="button" onClick={handleMarkAllRead}>
            Mark All Read
          </Button>
        </div>
      </div>

      <div className="notificationToolbar">
        <div className="notificationFilters">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`filterChip ${activeFilter === option.id ? "filterChipActive" : ""}`}
              onClick={() => setActiveFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="caption">{unreadCount} unread notifications</p>
      </div>

      {errorMessage ? <div className="errorBanner">{errorMessage}</div> : null}
      {isLoading ? <p className="caption">Loading notifications...</p> : null}

      <div className="notificationCenter">
        {filteredNotifications.length ? (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`notificationCard ${
                notification.isRead ? "notificationRead" : "notificationUnread"
              } notificationCardSelectable`}
            >
              <label className="notificationCheckbox">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(notification.id)}
                  onChange={() => handleToggleSelect(notification.id)}
                />
              </label>
              <button
                type="button"
                className="notificationBody"
                onClick={() => {
                  logInfo("ui", `Opening notification ${notification.id}`);
                  onOpenNotification(notification);
                }}
              >
                <div>
                  <div className="notificationHeader">
                    <h3>{notification.title}</h3>
                    {!notification.isRead ? <span className="notificationDot" /> : null}
                  </div>
                  <p className="muted">{notification.message}</p>
                </div>
                <div className="notificationMeta">
                  <span className="caption">{notification.time}</span>
                  <span className="notificationLink">Open {notification.contextLabel}</span>
                </div>
              </button>
              <span className={`notificationTag notificationTag${notification.type}`}>
                {notification.type}
              </span>
            </div>
          ))
        ) : !isLoading && !errorMessage ? (
          <div className="card emptyState">
            <h3>No notifications in this category</h3>
            <p className="muted">Try another filter or check back later.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
