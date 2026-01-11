import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loadingOverlay";
import { getCurrentUser } from "@/services/userService";
import { updateNotificationPreferences } from "@/services/notificationService";
import { getAuthSession, saveAuthSession } from "@/utils/authStorage";
import { logError, logInfo } from "@/utils/logger";

interface SettingsViewProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export default function SettingsView({ onDirtyChange }: SettingsViewProps) {
  const session = getAuthSession();
  const [settings, setSettings] = useState({ email: true, push: true });
  const [notificationEmail, setNotificationEmail] = useState(session?.user.email ?? "notifications@okrtracker.com");
  const [digestCadence, setDigestCadence] = useState("Weekly");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "error">("success");

  useEffect(() => {
    let isActive = true;

    const loadPreferences = async () => {
      setIsLoading(true);
      try {
        const user = await getCurrentUser();
        if (!isActive) {
          return;
        }
        const preferences = user.notificationPreferences;
        setSettings({
          email: preferences?.emailNotifications ?? true,
          push: preferences?.pushNotifications ?? true
        });
        setNotificationEmail(user.email);
      } catch (error) {
        logError("ui", "Failed to load notification preferences", error);
        if (isActive) {
          setToast("Unable to load settings right now.", "error");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadPreferences();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const handleToggle = (field: "email" | "push") => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
    setToastMessage(null);
    if (!isDirty) {
      setIsDirty(true);
      onDirtyChange(true);
    }
  };

  const handleFormChange = () => {
    if (!isDirty) {
      setIsDirty(true);
      onDirtyChange(true);
    }
  };

  const setToast = (message: string, tone: "success" | "error") => {
    setToastMessage(message);
    setToastTone(tone);
  };

  const validateSettings = () => {
    const nextErrors: Record<string, string> = {};
    const emailValue = notificationEmail.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

    if (!emailValue) {
      nextErrors.notificationEmail = "Notification email is required.";
    } else if (!isValidEmail) {
      nextErrors.notificationEmail = "Enter a valid email address.";
    }

    if (!digestCadence) {
      nextErrors.digestCadence = "Select a delivery cadence.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateSettings()) {
      logInfo("ui", "Settings validation failed");
      setToast("Please fix the highlighted settings fields.", "error");
      return;
    }

    setIsSaving(true);
    logInfo("ui", "Saving notification settings");

    updateNotificationPreferences({
      emailNotifications: settings.email,
      pushNotifications: settings.push
    })
      .then((preferences) => {
        const activeSession = getAuthSession();
        if (activeSession) {
          saveAuthSession({
            ...activeSession,
            user: {
              ...activeSession.user,
              notificationPreferences: preferences
            }
          });
        }
        setIsDirty(false);
        onDirtyChange(false);
        setToast("Your notification preferences have been updated successfully!", "success");
      })
      .catch((error) => {
        logError("ui", "Failed to update notification preferences", error);
        setToast("Unable to update notification preferences.", "error");
      })
      .finally(() => setIsSaving(false));
  };

  return (
    <section className="pageSection">
      <div className="sectionHeader">
        <div>
          <h1>Settings</h1>
          <p className="muted">Control how you receive OKR updates.</p>
        </div>
      </div>

      <div className="card settingsCard">
        <div className="formGrid twoColumn">
          <div className="inputField">
            <label htmlFor="notificationEmail">Notification Email</label>
            <input
              id="notificationEmail"
              className={`inputControl ${fieldErrors.notificationEmail ? "inputError" : ""}`}
              value={notificationEmail}
              onChange={(event) => {
                setNotificationEmail(event.target.value);
                if (fieldErrors.notificationEmail) {
                  setFieldErrors((prev) => {
                    const { notificationEmail: _removed, ...rest } = prev;
                    return rest;
                  });
                }
                handleFormChange();
              }}
            />
            {fieldErrors.notificationEmail ? (
              <span className="errorText">{fieldErrors.notificationEmail}</span>
            ) : null}
          </div>
          <div className="inputField">
            <label htmlFor="digestCadence">Digest Cadence</label>
            <select
              id="digestCadence"
              className={`inputControl ${fieldErrors.digestCadence ? "inputError" : ""}`}
              value={digestCadence}
              onChange={(event) => {
                setDigestCadence(event.target.value);
                if (fieldErrors.digestCadence) {
                  setFieldErrors((prev) => {
                    const { digestCadence: _removed, ...rest } = prev;
                    return rest;
                  });
                }
                handleFormChange();
              }}
            >
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
            {fieldErrors.digestCadence ? <span className="errorText">{fieldErrors.digestCadence}</span> : null}
          </div>
        </div>
        <div className="settingsRow">
          <div>
            <h3>Email Notifications</h3>
            <p className="muted">Get detailed updates in your inbox.</p>
          </div>
          <button
            type="button"
            className={`toggleSwitch ${settings.email ? "toggleOn" : ""}`}
            aria-pressed={settings.email}
            aria-label="Email notifications"
            onClick={() => handleToggle("email")}
          >
            <span className="toggleKnob" />
          </button>
        </div>
        <div className="settingsRow">
          <div>
            <h3>Push Notifications</h3>
            <p className="muted">Receive real-time alerts.</p>
          </div>
          <button
            type="button"
            className={`toggleSwitch ${settings.push ? "toggleOn" : ""}`}
            aria-pressed={settings.push}
            aria-label="Push notifications"
            onClick={() => handleToggle("push")}
          >
            <span className="toggleKnob" />
          </button>
        </div>
        <div className="formActions">
          <Button type="button" onClick={handleSave} disabled={!isDirty}>
            Save Changes
          </Button>
        </div>
      </div>

      {toastMessage ? (
        <div className={`toast ${toastTone === "success" ? "toastSuccess" : ""}`}>{toastMessage}</div>
      ) : null}
      {isSaving ? <LoadingOverlay message="Saving preferences" /> : null}
      {isLoading ? <LoadingOverlay message="Loading settings" /> : null}
    </section>
  );
}
