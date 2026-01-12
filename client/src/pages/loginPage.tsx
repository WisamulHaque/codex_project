import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loadingOverlay";
import { logInfo, logWarn } from "@/utils/logger";
import {
  forgotPassword,
  googleLogin,
  loginUser,
  registerUser,
  resendVerification,
  verifyEmail
} from "@/services/authService";
import { saveAuthSession } from "@/utils/authStorage";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type AuthView = "login" | "signup" | "forgotPassword" | "verifyEmail";
type GoogleStatus = "idle" | "loading" | "retry" | "failed";

interface LoginErrors {
  email?: string;
  password?: string;
}

interface SignupErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

interface GoogleOverlayProps {
  status: GoogleStatus;
  onRetry: () => void;
  onClose: () => void;
}

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

function GoogleRedirectOverlay({ status, onRetry, onClose }: GoogleOverlayProps) {
  const message =
    status === "failed"
      ? "Unable to connect to Google. Please try again later."
      : "Redirecting to Google... Please wait a moment.";

  return (
    <div className="authOverlay" role="dialog" aria-live="polite" aria-modal="true">
      <div className="authOverlayCard">
        <div className="overlayMascot" aria-hidden="true">
          <div className="overlayHead">
            <span className="overlayEye" />
            <span className="overlayEye" />
          </div>
          <div className="overlayJuggle">
            <span className="overlayOrb" />
            <span className="overlayOrb" />
            <span className="overlayOrb" />
          </div>
        </div>
        <p className="overlayMessage">{message}</p>
        {status === "retry" ? (
          <Button variant="secondary" onClick={onRetry}>
            Having trouble? Retry Google Login
          </Button>
        ) : null}
        {status === "failed" ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [authView, setAuthView] = useState<AuthView>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>("idle");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastActionLabel, setToastActionLabel] = useState<string | null>(null);
  const googleScriptPromiseRef = useRef<Promise<void> | null>(null);
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({});
  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});
  const [resetSent, setResetSent] = useState(false);
  const [verificationInput, setVerificationInput] = useState("");
  const [authEmail, setAuthEmail] = useState("");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [forgotEmail, setForgotEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  useEffect(() => {
    setLoginErrors({});
    setSignupErrors({});
    setToastMessage(null);
    setToastActionLabel(null);
    if (authView !== "forgotPassword") {
      setResetSent(false);
    }
    if (authView !== "verifyEmail") {
      setVerificationInput("");
    }
  }, [authView]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const passwordChecks = useMemo(() => {
    return {
      length: signupForm.password.length >= 8,
      number: /\d/.test(signupForm.password),
      special: /[^A-Za-z0-9]/.test(signupForm.password)
    };
  }, [signupForm.password]);

  const ensureGoogleScript = useCallback(() => {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("Google login is unavailable."));
    }
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }
    if (googleScriptPromiseRef.current) {
      return googleScriptPromiseRef.current;
    }

    googleScriptPromiseRef.current = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Failed to load Google sign-in")));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        logInfo("ui", "Google script loaded");
        resolve();
      };
      script.onerror = () => {
        logWarn("ui", "Failed to load Google sign-in script");
        reject(new Error("Failed to load Google sign-in"));
      };
      document.head.appendChild(script);
    });

    return googleScriptPromiseRef.current;
  }, []);

  useEffect(() => {
    if (!googleClientId) {
      return;
    }
    void ensureGoogleScript().catch(() => undefined);
  }, [ensureGoogleScript]);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: LoginErrors = {};
    if (!loginForm.email.trim()) {
      nextErrors.email = "Email is required.";
    }
    if (!loginForm.password.trim()) {
      nextErrors.password = "Password is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setLoginErrors(nextErrors);
      logWarn("ui", "Login form validation failed");
      return;
    }

    setLoginErrors({});
    setIsSubmitting(true);
    setToastMessage(null);
    setToastActionLabel(null);
    setAuthEmail(loginForm.email.trim());
    logInfo("ui", "Login submitted");

    try {
      const response = await loginUser({
        email: loginForm.email.trim(),
        password: loginForm.password
      });

      if (!response.accessToken || !response.refreshToken) {
        throw new Error("Login response missing tokens.");
      }

      saveAuthSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.data
      });

      logInfo("ui", "Login success");
      onLoginSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed.";
      logWarn("ui", message);
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes("verify")) {
        setAuthView("verifyEmail");
        setToastMessage(message);
      } else if (lowerMessage.includes("email")) {
        setLoginErrors((prev) => ({ ...prev, email: message }));
        setToastMessage("Uh-oh! Your email or password isn't correct.");
        setToastActionLabel("Forgot Password?");
      } else if (lowerMessage.includes("password")) {
        setLoginErrors((prev) => ({ ...prev, password: message }));
        setToastMessage("Uh-oh! Your email or password isn't correct.");
        setToastActionLabel("Forgot Password?");
      } else {
        setToastMessage(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleStatus("loading");
    logInfo("ui", "Google login initiated");

    if (!googleClientId) {
      setGoogleStatus("failed");
      setToastMessage("Google login is not configured. Set VITE_GOOGLE_CLIENT_ID and redeploy.");
      return;
    }

    try {
      await ensureGoogleScript();
    } catch (error) {
      setGoogleStatus("failed");
      setToastMessage("Google login could not be initialized. Please retry.");
      logWarn("ui", "Google login script unavailable", error);
      return;
    }

    if (!window.google?.accounts?.id) {
      setGoogleStatus("failed");
      setToastMessage("Google login could not be initialized. Please retry.");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response: { credential?: string }) => {
        if (!response.credential) {
          setGoogleStatus("failed");
          return;
        }

        try {
          const result = await googleLogin({ idToken: response.credential });
          if (!result.accessToken || !result.refreshToken) {
            throw new Error("Google login response missing tokens.");
          }

          saveAuthSession({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            user: result.data
          });
          setGoogleStatus("idle");
          onLoginSuccess?.();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Google login failed.";
          setGoogleStatus("failed");
          setToastMessage(message);
        }
      }
    });

    window.google.accounts.id.prompt((notification: { isNotDisplayed?: () => boolean }) => {
      if (notification?.isNotDisplayed?.()) {
        setGoogleStatus("failed");
      }
    });
  };

  const handleRetryGoogle = () => {
    logInfo("ui", "Google login retry");
    void handleGoogleLogin();
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!forgotEmail.trim()) {
      setToastMessage("Email is required.");
      return;
    }

    setIsSubmitting(true);
    logInfo("ui", "Password reset requested");
    try {
      const response = await forgotPassword({ email: forgotEmail.trim() });
      setResetSent(true);
      setToastMessage(response.message ?? "Reset email sent! Check your inbox.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send reset link.";
      setToastMessage(message);
      logWarn("ui", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: SignupErrors = {};
    if (!signupForm.fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }
    if (!signupForm.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!signupForm.email.trim().toLowerCase().endsWith("@emumba.com")) {
      nextErrors.email = "Use your @emumba.com email address.";
    }
    if (!signupForm.password.trim()) {
      nextErrors.password = "Password is required.";
    } else if (!passwordChecks.length || !passwordChecks.number || !passwordChecks.special) {
      nextErrors.password = "Your password must include at least 8 characters, a number, and a special character.";
    }
    if (!signupForm.confirmPassword.trim()) {
      nextErrors.confirmPassword = "Confirm password is required.";
    } else if (signupForm.password !== signupForm.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setSignupErrors(nextErrors);
      logWarn("ui", "Signup form validation failed");
      return;
    }

    setSignupErrors({});
    setIsSubmitting(true);
    setToastMessage(null);
    setAuthEmail(signupForm.email.trim());
    logInfo("ui", "Signup submitted");

    const [firstName, ...lastNameParts] = signupForm.fullName.trim().split(" ");
    const lastName = lastNameParts.join(" ") || "User";

    try {
      const response = await registerUser({
        firstName,
        lastName,
        email: signupForm.email.trim(),
        password: signupForm.password
      });

      void response;
      setAuthView("verifyEmail");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signup failed.";
      if (message.toLowerCase().includes("email")) {
        setSignupErrors((prev) => ({ ...prev, email: message }));
      } else if (message.toLowerCase().includes("password")) {
        setSignupErrors((prev) => ({ ...prev, password: message }));
      } else {
        setToastMessage(message);
      }
      logWarn("ui", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToastAction = () => {
    setAuthView("forgotPassword");
    setToastMessage(null);
    setToastActionLabel(null);
  };

  return (
    <div className="authLayout">
      <section className="authLeft">
        <div className="authIntro">
          <p className="eyebrow">OKR Tracker App</p>
          <h1>Welcome to OKR Tracker - Your Personal OKR Assistant!</h1>
          <p className="muted">
            Define goals, track progress, and achieve greatness. Your journey starts here!
          </p>
        </div>
        <div className="mascotCard">
          <div className="mascot">
            <div className="mascotHead">
              <span className="mascotEye" />
              <span className="mascotEye" />
            </div>
            <div className="mascotBody">
              <span className="mascotLight" />
            </div>
            <div className="mascotArm" />
          </div>
          <div className="speechBubble">
            <p>Hey there! Ready to crush some goals?</p>
          </div>
        </div>
        <div className="authHighlights">
          <div>
            <p className="caption">Focus</p>
            <p>Turn strategy into weekly execution.</p>
          </div>
          <div>
            <p className="caption">Momentum</p>
            <p>Track key results with smart signals.</p>
          </div>
          <div>
            <p className="caption">Visibility</p>
            <p>Align teams with shared outcomes.</p>
          </div>
        </div>
      </section>

      <section className="authRight">
        <div className="authPanel">
          {authView === "login" ? (
            <>
              <div className="authHeader">
                <h2>Log in to Get Started!</h2>
                <p className="muted">Use your email or connect with Google.</p>
              </div>

              <button className="googleButton" type="button" onClick={handleGoogleLogin}>
                <span className="googleIcon">G</span>
                Sign in with Google
              </button>

              <div className="authDivider">
                <span>or</span>
              </div>

              <form className="authForm" onSubmit={handleLoginSubmit} noValidate>
                <div className="inputField">
                  <label htmlFor="loginEmail">Email</label>
                  <input
                    id="loginEmail"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email"
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className={`inputControl ${loginErrors.email ? "inputError" : ""}`}
                    aria-invalid={Boolean(loginErrors.email)}
                    aria-describedby={loginErrors.email ? "loginEmailError" : undefined}
                    data-testid="login-email"
                  />
                  {loginErrors.email ? (
                    <span id="loginEmailError" className="errorText">
                      {loginErrors.email}
                    </span>
                  ) : null}
                </div>

                <div className="inputField">
                  <label htmlFor="loginPassword">Password</label>
                  <div className="passwordField">
                    <input
                      id="loginPassword"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      className={`inputControl ${loginErrors.password ? "inputError" : ""}`}
                      aria-invalid={Boolean(loginErrors.password)}
                      aria-describedby={loginErrors.password ? "loginPasswordError" : undefined}
                      data-testid="login-password"
                    />
                    <button
                      type="button"
                      className="passwordToggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <span className="eyeIcon" aria-hidden="true" />
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {loginErrors.password ? (
                    <span id="loginPasswordError" className="errorText">
                      {loginErrors.password}
                    </span>
                  ) : null}
                </div>

                <div className="authRow">
                  <button
                    type="button"
                    className="textLink"
                    onClick={() => {
                      setAuthView("forgotPassword");
                      setResetSent(false);
                      setForgotEmail(loginForm.email);
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button type="submit" data-testid="login-submit">
                  Log In
                </Button>
              </form>

              <div className="authFooter">
                <p className="muted">Don't have an account yet?</p>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setAuthView("signup")}
                >
                  Create One
                </Button>
              </div>
            </>
          ) : null}

          {authView === "signup" ? (
            <>
              <div className="authHeader">
                <h2>Create Your Account</h2>
                <p className="muted">Start aligning your objectives in minutes.</p>
              </div>
              <form className="authForm" onSubmit={handleSignupSubmit} noValidate>
                <div className="inputField">
                  <label htmlFor="signupName">Full Name</label>
                  <input
                    id="signupName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Enter your full name"
                    value={signupForm.fullName}
                    onChange={(event) =>
                      setSignupForm((prev) => ({ ...prev, fullName: event.target.value }))
                    }
                    className={`inputControl ${signupErrors.fullName ? "inputError" : ""}`}
                    aria-invalid={Boolean(signupErrors.fullName)}
                    aria-describedby={signupErrors.fullName ? "signupNameError" : undefined}
                  />
                  {signupErrors.fullName ? (
                    <span id="signupNameError" className="errorText">
                      {signupErrors.fullName}
                    </span>
                  ) : null}
                </div>

                <div className="inputField">
                  <label htmlFor="signupEmail">Email</label>
                  <input
                    id="signupEmail"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email"
                    value={signupForm.email}
                    onChange={(event) =>
                      setSignupForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className={`inputControl ${signupErrors.email ? "inputError" : ""}`}
                    aria-invalid={Boolean(signupErrors.email)}
                    aria-describedby={signupErrors.email ? "signupEmailError" : undefined}
                  />
                  {signupErrors.email ? (
                    <span id="signupEmailError" className="errorText">
                      {signupErrors.email}
                    </span>
                  ) : null}
                </div>

                <div className="inputField">
                  <label htmlFor="signupPassword">Password</label>
                  <div className="passwordField">
                    <input
                      id="signupPassword"
                      name="password"
                      type={showSignupPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Create a secure password"
                      value={signupForm.password}
                      onChange={(event) =>
                        setSignupForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      className={`inputControl ${signupErrors.password ? "inputError" : ""}`}
                      aria-invalid={Boolean(signupErrors.password)}
                      aria-describedby={signupErrors.password ? "signupPasswordError" : undefined}
                    />
                    <button
                      type="button"
                      className="passwordToggle"
                      onClick={() => setShowSignupPassword((prev) => !prev)}
                      aria-label={showSignupPassword ? "Hide password" : "Show password"}
                    >
                      <span className="eyeIcon" aria-hidden="true" />
                      {showSignupPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {signupErrors.password ? (
                    <span id="signupPasswordError" className="errorText">
                      {signupErrors.password}
                    </span>
                  ) : null}
                </div>

                <div className="passwordChecklist">
                  <p className="caption">Password requirements</p>
                  <ul>
                    <li className={passwordChecks.length ? "checkItemActive" : ""}>
                      At least 8 characters
                    </li>
                    <li className={passwordChecks.number ? "checkItemActive" : ""}>
                      Contains a number
                    </li>
                    <li className={passwordChecks.special ? "checkItemActive" : ""}>
                      Contains a special character
                    </li>
                  </ul>
                </div>

                <div className="inputField">
                  <label htmlFor="signupConfirm">Confirm Password</label>
                  <input
                    id="signupConfirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    value={signupForm.confirmPassword}
                    onChange={(event) =>
                      setSignupForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    className={`inputControl ${signupErrors.confirmPassword ? "inputError" : ""}`}
                    aria-invalid={Boolean(signupErrors.confirmPassword)}
                    aria-describedby={signupErrors.confirmPassword ? "signupConfirmError" : undefined}
                  />
                  {signupErrors.confirmPassword ? (
                    <span id="signupConfirmError" className="errorText">
                      {signupErrors.confirmPassword}
                    </span>
                  ) : null}
                </div>

                <Button type="submit">Create My Account</Button>
              </form>

              <div className="authFooter">
                <Button variant="tertiary" type="button" onClick={() => setAuthView("login")}>
                  Already have an account? Log In Here
                </Button>
              </div>
            </>
          ) : null}

          {authView === "forgotPassword" ? (
            <>
              <div className="authHeader">
                <h2>Forgot Your Password?</h2>
                <p className="muted">No worries, we've got you covered!</p>
              </div>
              <form className="authForm" onSubmit={handleResetPassword}>
                <div className="inputField">
                  <label htmlFor="resetEmail">Email</label>
                  <input
                    id="resetEmail"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email"
                    className="inputControl"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                  />
                </div>
                <Button type="submit">Send Reset Link</Button>
                {resetSent ? <p className="successText">Reset email sent! Check your inbox.</p> : null}
              </form>
              <div className="authFooter">
                <Button variant="tertiary" type="button" onClick={() => setAuthView("login")}>
                  Back to login
                </Button>
              </div>
            </>
          ) : null}

          {authView === "verifyEmail" ? (
            <>
              <div className="authHeader">
                <h2>Verify Your Email to Get Started!</h2>
                <p className="muted">Check your inbox for a confirmation link.</p>
              </div>
              <div className="verifyCard">
                <div className="envelopeMascot" aria-hidden="true">
                  <div className="envelopeBody" />
                  <div className="envelopeTop" />
                </div>
                <p className="caption">We sent a verification link to {authEmail || "your email"}.</p>
                <div className="inputField">
                  <label htmlFor="verifyToken">Verification Token</label>
                  <input
                    id="verifyToken"
                    type="text"
                    className="inputControl"
                    placeholder="Paste verification token"
                    value={verificationInput}
                    onChange={(event) => setVerificationInput(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  onClick={async () => {
                    if (!verificationInput.trim()) {
                      setToastMessage("Verification token is required.");
                      return;
                    }
                    setIsSubmitting(true);
                    try {
                      await verifyEmail({ token: verificationInput.trim() });
                      setToastMessage("Email verified successfully.");
                      setAuthView("login");
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Verification failed.";
                      setToastMessage(message);
                      logWarn("ui", message);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  Verify Email
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={async () => {
                    if (!authEmail.trim()) {
                      setToastMessage("Email is required to resend verification.");
                      return;
                    }
                    setIsSubmitting(true);
                    try {
                      const response = await resendVerification({ email: authEmail.trim() });
                      void response;
                      setToastMessage("Verification email resent.");
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Unable to resend verification.";
                      setToastMessage(message);
                      logWarn("ui", message);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  Resend Verification Email
                </Button>
              </div>
              <div className="authFooter">
                <Button variant="tertiary" type="button" onClick={() => setAuthView("login")}>
                  Back to login
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {toastMessage ? (
        <div className="toast" role="status" aria-live="polite">
          <span>{toastMessage}</span>
          {toastActionLabel ? (
            <button className="toastAction" type="button" onClick={handleToastAction}>
              {toastActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      {isSubmitting ? <LoadingOverlay message="Processing request" /> : null}
      {googleStatus !== "idle" ? (
        <GoogleRedirectOverlay
          status={googleStatus}
          onRetry={handleRetryGoogle}
          onClose={() => {
            setGoogleStatus("idle");
          }}
        />
      ) : null}
    </div>
  );
}
