import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loadingOverlay";
import { logInfo, logWarn } from "@/utils/logger";
import { getAuthSession } from "@/utils/authStorage";
import { getCurrentUser, updateAvatar, updatePassword, updateProfile } from "@/services/userService";

interface ProfileViewProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export default function ProfileView({ onDirtyChange }: ProfileViewProps) {
  const [authSession] = useState(() => getAuthSession());
  const [profile, setProfile] = useState({
    firstName: authSession?.user.firstName ?? "",
    lastName: authSession?.user.lastName ?? "",
    designation: authSession?.user.designation ?? "",
    department: authSession?.user.department ?? ""
  });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "error">("success");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(authSession?.user.avatarUrl ?? null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const profileInitials = `${profile.firstName.trim().charAt(0)}${profile.lastName.trim().charAt(0)}`.toUpperCase();

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!avatarPreviewUrl) {
      return;
    }

    if (!avatarPreviewUrl.startsWith("blob:")) {
      return;
    }

    return () => URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    let isMounted = true;
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const user = await getCurrentUser();
        if (!isMounted) {
          return;
        }
        setProfile({
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          designation: user.designation ?? "",
          department: user.department ?? ""
        });
        if (user.avatarUrl) {
          setAvatarPreviewUrl(user.avatarUrl);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load profile.";
        setToast(message, "error");
        logWarn("ui", message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, [authSession]);

  const handleProfileChange = (field: keyof typeof profile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    if (profileErrors[field]) {
      setProfileErrors((prev) => {
        const { [field]: _removed, ...rest } = prev;
        return rest;
      });
    }
    if (!isDirty) {
      setIsDirty(true);
      onDirtyChange(true);
    }
  };

  const handlePasswordChange = (field: keyof typeof passwordForm, value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    if (passwordErrors[field]) {
      setPasswordErrors((prev) => {
        const { [field]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const setToast = (message: string, tone: "success" | "error") => {
    setToastMessage(message);
    setToastTone(tone);
  };

  const validateProfile = () => {
    const nextErrors: Record<string, string> = {};

    if (!profile.firstName.trim()) {
      nextErrors.firstName = "First name is required.";
    }

    if (!profile.lastName.trim()) {
      nextErrors.lastName = "Last name is required.";
    }

    if (!profile.designation.trim()) {
      nextErrors.designation = "Designation is required.";
    }

    if (!profile.department.trim()) {
      nextErrors.department = "Department is required.";
    }

    setProfileErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) {
      logInfo("ui", "Profile validation failed");
      setToast("Please fix the highlighted profile fields.", "error");
      return;
    }

    setIsProcessing(true);
    logInfo("ui", "Saving profile");

    try {
      const response = await updateProfile({
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        designation: profile.designation.trim(),
        department: profile.department.trim()
      });
      setIsDirty(false);
      onDirtyChange(false);
      setToast(response.message ?? "Profile updated successfully.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile.";
      setToast(message, "error");
      logWarn("ui", message);
    } finally {
      setIsProcessing(false);
    }
  };

  const validatePassword = () => {
    const nextErrors: Record<string, string> = {};
    const hasNumber = /\d/.test(passwordForm.newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(passwordForm.newPassword);

    if (!passwordForm.oldPassword.trim()) {
      nextErrors.oldPassword = "Old password is required.";
    }

    if (!passwordForm.newPassword.trim()) {
      nextErrors.newPassword = "New password is required.";
    } else if (passwordForm.newPassword.length < 8 || !hasNumber || !hasSpecial) {
      nextErrors.newPassword = "Use at least 8 characters, a number, and a special character.";
    }

    if (!passwordForm.confirmPassword.trim()) {
      nextErrors.confirmPassword = "Please confirm your new password.";
    } else if (passwordForm.confirmPassword !== passwordForm.newPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setPasswordErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePasswordSave = async () => {
    if (!validatePassword()) {
      logInfo("ui", "Password validation failed");
      setToast("Please fix the highlighted password fields.", "error");
      return;
    }

    setIsProcessing(true);
    logInfo("ui", "Updating password");

    try {
      const response = await updatePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setToast(response.message ?? "Password updated successfully.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update password.";
      setToast(message, "error");
      logWarn("ui", message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAvatarSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file.");
      setAvatarFile(null);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be smaller than 2MB.");
      setAvatarFile(null);
      return;
    }

    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      setAvatarError("Select an image to upload.");
      setToast("Please select a profile image.", "error");
      return;
    }

    setIsProcessing(true);
    logInfo("ui", "Uploading profile photo");

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Unable to read image."));
          }
        };
        reader.onerror = () => reject(new Error("Unable to read image."));
        reader.readAsDataURL(avatarFile);
      });

      const response = await updateAvatar({ avatarUrl: dataUrl });
      setAvatarPreviewUrl(response.data.avatarUrl ?? dataUrl);
      setAvatarFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setToast(response.message ?? "Profile photo updated successfully.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile photo.";
      setAvatarError(message);
      setToast(message, "error");
      logWarn("ui", message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAvatarRemove = async () => {
    setIsProcessing(true);
    try {
      const response = await updateAvatar({ avatarUrl: "" });
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setAvatarError(null);
      setToast(response.message ?? "Profile photo removed.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to remove profile photo.";
      setToast(message, "error");
      logWarn("ui", message);
    } finally {
      setIsProcessing(false);
    }
  };

  const passwordHints = [
    { label: "8+ characters", isMet: passwordForm.newPassword.length >= 8 },
    { label: "1 number", isMet: /\d/.test(passwordForm.newPassword) },
    { label: "1 special character", isMet: /[^A-Za-z0-9]/.test(passwordForm.newPassword) }
  ];

  return (
    <section className="pageSection">
      <div className="sectionHeader">
        <div>
          <h1>Profile</h1>
          <p className="muted">Update your personal details and password.</p>
        </div>
      </div>

      <div className="profileGrid">
        <div className="card">
          <h2>Personal information</h2>
          <div className="profileAvatarRow">
            <div className="profileAvatar">
              {avatarPreviewUrl ? (
                <img src={avatarPreviewUrl} alt="Profile preview" className="profileAvatarImage" />
              ) : (
                profileInitials || "OK"
              )}
            </div>
            <div className="profileUploadMeta">
              <p className="caption">Profile picture</p>
              <p className="muted">JPG or PNG up to 2MB.</p>
              <div className="profileUploadActions">
                <input
                  ref={fileInputRef}
                  type="file"
                  className={`fileInput ${avatarError ? "inputError" : ""}`}
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  aria-label="Upload profile picture"
                />
                <Button variant="secondary" type="button" onClick={handleAvatarUpload}>
                  Upload
                </Button>
                <Button variant="tertiary" type="button" onClick={handleAvatarRemove}>
                  Remove
                </Button>
              </div>
              {avatarError ? <span className="errorText">{avatarError}</span> : null}
            </div>
          </div>
          <div className="formGrid">
            <div className="inputField">
              <label htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                className={`inputControl ${profileErrors.firstName ? "inputError" : ""}`}
                value={profile.firstName}
                onChange={(event) => handleProfileChange("firstName", event.target.value)}
              />
              {profileErrors.firstName ? <span className="errorText">{profileErrors.firstName}</span> : null}
            </div>
            <div className="inputField">
              <label htmlFor="lastName">Last Name</label>
              <input
                id="lastName"
                className={`inputControl ${profileErrors.lastName ? "inputError" : ""}`}
                value={profile.lastName}
                onChange={(event) => handleProfileChange("lastName", event.target.value)}
              />
              {profileErrors.lastName ? <span className="errorText">{profileErrors.lastName}</span> : null}
            </div>
            <div className="inputField">
              <label htmlFor="designation">Designation</label>
              <input
                id="designation"
                className={`inputControl ${profileErrors.designation ? "inputError" : ""}`}
                value={profile.designation}
                onChange={(event) => handleProfileChange("designation", event.target.value)}
              />
              {profileErrors.designation ? <span className="errorText">{profileErrors.designation}</span> : null}
            </div>
            <div className="inputField">
              <label htmlFor="department">Department</label>
              <input
                id="department"
                className={`inputControl ${profileErrors.department ? "inputError" : ""}`}
                value={profile.department}
                onChange={(event) => handleProfileChange("department", event.target.value)}
              />
              {profileErrors.department ? <span className="errorText">{profileErrors.department}</span> : null}
            </div>
          </div>
          <div className="formActions">
            <Button type="button" onClick={handleSaveProfile}>
              Save Profile
            </Button>
          </div>
        </div>

        <div className="card">
          <h2>Change password</h2>
          <div className="formGrid">
            <div className="inputField">
              <label htmlFor="oldPassword">Old Password</label>
              <input
                id="oldPassword"
                type="password"
                className={`inputControl ${passwordErrors.oldPassword ? "inputError" : ""}`}
                value={passwordForm.oldPassword}
                onChange={(event) => handlePasswordChange("oldPassword", event.target.value)}
              />
              {passwordErrors.oldPassword ? <span className="errorText">{passwordErrors.oldPassword}</span> : null}
            </div>
            <div className="inputField">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                className={`inputControl ${passwordErrors.newPassword ? "inputError" : ""}`}
                value={passwordForm.newPassword}
                onChange={(event) => handlePasswordChange("newPassword", event.target.value)}
              />
              <div className="passwordHints">
                {passwordHints.map((hint) => (
                  <span key={hint.label} className={hint.isMet ? "passwordHintMet" : ""}>
                    {hint.label}
                  </span>
                ))}
              </div>
              {passwordErrors.newPassword ? <span className="errorText">{passwordErrors.newPassword}</span> : null}
            </div>
            <div className="inputField">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                type="password"
                className={`inputControl ${passwordErrors.confirmPassword ? "inputError" : ""}`}
                value={passwordForm.confirmPassword}
                onChange={(event) => handlePasswordChange("confirmPassword", event.target.value)}
              />
              {passwordErrors.confirmPassword ? (
                <span className="errorText">{passwordErrors.confirmPassword}</span>
              ) : null}
            </div>
          </div>
          <div className="formActions">
            <Button type="button" onClick={handlePasswordSave}>
              Update Password
            </Button>
          </div>
        </div>
      </div>

      {toastMessage ? (
        <div className={`toast ${toastTone === "success" ? "toastSuccess" : ""}`}>{toastMessage}</div>
      ) : null}
      {isLoading || isProcessing ? (
        <LoadingOverlay message={isLoading ? "Loading profile" : "Saving changes"} />
      ) : null}
    </section>
  );
}
