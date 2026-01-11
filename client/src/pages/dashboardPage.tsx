import React, { Suspense, useEffect, useState } from "react";
import { AppShell, AppPage } from "@/components/layout/appShell";
import { LoadingOverlay } from "@/components/ui/loadingOverlay";
import type { NotificationDto, NotificationItem } from "@/features/notifications/notificationTypes";
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markNotificationsRead } from "@/services/notificationService";
import { logInfo, logError } from "@/utils/logger";
import { useAuth } from "@/context/authContext";

const HomeView = React.lazy(() => import("@/pages/dashboard/homeView"));
const OkrsView = React.lazy(() => import("@/pages/dashboard/okrsView"));
const TeamView = React.lazy(() => import("@/pages/dashboard/teamView"));
const ReportsView = React.lazy(() => import("@/pages/dashboard/reportsView"));
const NotificationsView = React.lazy(() => import("@/pages/dashboard/notificationsView"));
const ProfileView = React.lazy(() => import("@/pages/dashboard/profileView"));

interface DashboardPageProps {
  onLogout: () => void;
}

const formatRelativeTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) {
    return "Just now";
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
};

const mapNotificationToItem = (notification: NotificationDto): NotificationItem => ({
  id: notification.id,
  title: notification.title,
  message: notification.message,
  time: formatRelativeTime(notification.createdAt),
  isRead: notification.isRead,
  contextLabel: notification.contextLabel ?? "update",
  contextId: notification.contextId,
  type: notification.type
});

export default function DashboardPage({ onLogout }: DashboardPageProps) {
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingCreateOkr, setPendingCreateOkr] = useState(false);
  const [pendingOpenOkrId, setPendingOpenOkrId] = useState<string | null>(null);

  const { session } = useAuth();
  const userName = session ? `${session.user.firstName} ${session.user.lastName}`.trim() : "Avery Morgan";
  const userRole = (session?.user.role as "admin" | "manager" | "employee" | undefined) ?? "admin";
  const handleNavigate = (page: AppPage) => {
    setActivePage(page);
    logInfo("ui", `Navigated to ${page}`);
  };

  useEffect(() => {
    if (!session?.user.id) {
      return;
    }
    const seenKey = `okr_home_seen_${session.user.id}`;
    const hasSeen = localStorage.getItem(seenKey) === "true";
    setIsFirstTimeUser(!hasSeen);
  }, [session?.user.id]);

  const handleFirstTimeSeen = () => {
    if (!session?.user.id) {
      return;
    }
    const seenKey = `okr_home_seen_${session.user.id}`;
    localStorage.setItem(seenKey, "true");
    setIsFirstTimeUser(false);
  };

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    let isActive = true;

    const loadNotifications = async () => {
      setNotificationsLoading(true);
      setNotificationsError(null);

      try {
        const data = await getNotifications();
        if (!isActive) {
          return;
        }
        const mapped = data.map(mapNotificationToItem);
        setNotifications(mapped);
        setUnreadNotifications(mapped.filter((item) => !item.isRead).length);
      } catch (error) {
        logError("ui", "Failed to load notifications", error);
        if (isActive) {
          setNotificationsError("Unable to load notifications right now.");
        }
      } finally {
        if (isActive) {
          setNotificationsLoading(false);
        }
      }
    };

    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadNotificationCount();
        if (isActive) {
          setUnreadNotifications(count);
        }
      } catch (error) {
        logError("ui", "Failed to load unread notification count", error);
      }
    };

    void loadNotifications();
    void loadUnreadCount();

    return () => {
      isActive = false;
    };
  }, [session?.accessToken]);

  const handleOpenNotification = (notification: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
    );
    void markNotificationRead(notification.id).catch((error) =>
      logError("ui", "Failed to mark notification read", error)
    );
    void getUnreadNotificationCount()
      .then((count) => setUnreadNotifications(count))
      .catch((error) => logError("ui", "Failed to refresh unread count", error));
    setActivePage("okrs");
    if (notification.contextLabel.toLowerCase() === "okr" && notification.contextId) {
      setPendingOpenOkrId(notification.contextId);
    } else {
      setPendingOpenOkrId(null);
    }
    logInfo("ui", `Notification ${notification.id} opened`);
  };

  const handleMarkNotificationsRead = (notificationIds: string[]) => {
    setNotifications((prev) =>
      prev.map((item) =>
        notificationIds.includes(item.id) ? { ...item, isRead: true } : item
      )
    );
    void markNotificationsRead(notificationIds)
      .then((updatedCount) => {
        logInfo("ui", `Marked ${updatedCount} notifications as read`);
      })
      .catch((error) => logError("ui", "Failed to mark notifications read", error))
      .finally(() => {
        void getUnreadNotificationCount()
          .then((count) => setUnreadNotifications(count))
          .catch((error) => logError("ui", "Failed to refresh unread count", error));
      });
  };

  const handleCreateOkr = () => {
    setActivePage("okrs");
    setPendingCreateOkr(true);
    logInfo("ui", "Navigated to OKRs to create new objective");
  };

  return (
    <AppShell
      activePage={activePage}
      onNavigate={handleNavigate}
      onLogout={onLogout}
      userName={userName}
      userAvatarUrl={session?.user.avatarUrl ?? null}
      userRole={userRole}
      unreadNotifications={unreadNotifications}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <Suspense fallback={<LoadingOverlay message="Loading workspace" />}>
        {activePage === "home" ? (
          <HomeView
            userName={userName}
            isFirstTimeUser={isFirstTimeUser}
            onCreateOkr={handleCreateOkr}
            onFirstTimeSeen={handleFirstTimeSeen}
          />
        ) : null}
        {activePage === "okrs" ? (
          <OkrsView
            currentUser={userName}
            currentUserId={session?.user.id ?? ""}
            openCreateOnLoad={pendingCreateOkr}
            onCreateHandled={() => setPendingCreateOkr(false)}
            openOkrId={pendingOpenOkrId ?? undefined}
            onOkrOpened={() => setPendingOpenOkrId(null)}
          />
        ) : null}
        {activePage === "team" ? <TeamView currentUserRole={userRole} /> : null}
        {activePage === "reports" ? <ReportsView /> : null}
        {activePage === "notifications" ? (
          <NotificationsView
            notifications={notifications}
            onOpenNotification={handleOpenNotification}
            onMarkRead={handleMarkNotificationsRead}
            isLoading={notificationsLoading}
            errorMessage={notificationsError}
          />
        ) : null}
        {activePage === "profile" ? (
          <ProfileView onDirtyChange={setHasUnsavedChanges} />
        ) : null}
      </Suspense>
    </AppShell>
  );
}
