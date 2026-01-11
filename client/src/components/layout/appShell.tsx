import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export type AppPage =
  | "home"
  | "okrs"
  | "team"
  | "reports"
  | "notifications"
  | "profile"
  | "settings";

interface AppShellProps {
  children: ReactNode;
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  onLogout: () => void;
  userName: string;
  userAvatarUrl?: string | null;
  userRole: "admin" | "manager" | "employee";
  unreadNotifications: number;
  hasUnsavedChanges: boolean;
}

const navItems: Array<{ id: AppPage; label: string }> = [
  { id: "home", label: "Home" },
  { id: "okrs", label: "OKRs" },
  { id: "team", label: "Team" },
  { id: "reports", label: "Reports" }
];

export function AppShell({
  children,
  activePage,
  onNavigate,
  onLogout,
  userName,
  userAvatarUrl,
  userRole,
  unreadNotifications,
  hasUnsavedChanges
}: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogoutClick = () => {
    setIsMenuOpen(false);
    if (hasUnsavedChanges) {
      setIsLogoutConfirmOpen(true);
      return;
    }
    onLogout();
  };

  const handleMenuSelect = (page: AppPage) => {
    setIsMenuOpen(false);
    onNavigate(page);
  };

  return (
    <div className="appShell">
      <header className="appBar">
        <div className="appBarLeft">
          <div className="appLogo">OKR</div>
          <div>
            <p className="brandTitle">OKR Tracker</p>
            <p className="brandCaption">Alignment workspace</p>
          </div>
        </div>
        <nav className="appBarNav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`navLink ${activePage === item.id ? "navLinkActive" : ""}`}
              onClick={() => onNavigate(item.id)}
              aria-current={activePage === item.id ? "page" : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="appBarActions">
          <button
            type="button"
            className={`iconButton ${activePage === "notifications" ? "iconButtonActive" : ""}`}
            onClick={() => onNavigate("notifications")}
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 3c-3.3 0-6 2.7-6 6v3.6l-1.4 2.5c-.3.6.1 1.4.8 1.4h13.2c.7 0 1.1-.8.8-1.4L18 12.6V9c0-3.3-2.7-6-6-6zm0 18c1.3 0 2.3-1 2.3-2.3H9.7C9.7 20 10.7 21 12 21z"
              />
            </svg>
            {unreadNotifications > 0 ? (
              <span className="notificationBadge">{unreadNotifications}</span>
            ) : null}
          </button>
          <div className="avatarMenu">
            <button
              type="button"
              className="avatarButton"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
            >
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt={`${userName} avatar`} className="avatarImage" />
              ) : (
                <span>{initials}</span>
              )}
            </button>
            {isMenuOpen ? (
              <div className="menuPanel" role="menu">
                <button type="button" role="menuitem" onClick={() => handleMenuSelect("profile")}>
                  View Profile
                </button>
                {userRole === "admin" ? (
                  <button type="button" role="menuitem" onClick={() => handleMenuSelect("team")}>
                    User management for Admin
                  </button>
                ) : null}
                <button type="button" role="menuitem" onClick={() => handleMenuSelect("settings")}>
                  Settings
                </button>
                <button type="button" role="menuitem" onClick={handleLogoutClick}>
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mainArea">{children}</main>

      <Modal
        isOpen={isLogoutConfirmOpen}
        title="Unsaved changes"
        description="You have unsaved changes. Are you sure you want to log out?"
        onClose={() => setIsLogoutConfirmOpen(false)}
        actions={
          <>
            <Button variant="secondary" type="button" onClick={() => setIsLogoutConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={() => {
                setIsLogoutConfirmOpen(false);
                onLogout();
              }}
            >
              Log out anyway
            </Button>
          </>
        }
      />
    </div>
  );
}
