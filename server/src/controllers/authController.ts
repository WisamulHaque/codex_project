import type { Request, Response } from "express";
import {
  loginUser,
  loginWithGoogle,
  registerUser,
  refreshSession as refreshAuthSession,
  logoutSession as logoutAuthSession,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  verifyEmail
} from "../services/authService";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";
import type { UserDocument } from "../models/userModel";

function toSafeUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    department: user.department,
    designation: user.designation,
    manager: user.manager,
    avatarUrl: user.avatarUrl,
    notificationPreferences: user.notificationPreferences ?? {
      emailNotifications: true,
      pushNotifications: true
    },
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function register(request: Request, response: Response) {
  const { firstName, lastName, email, password } = request.body ?? {};

  if (!firstName || !lastName || !email || !password) {
    throw new AppError("Full name, email, and password are required.", 400);
  }

  logInfo("auth", "Register request received");
  const { user, verificationToken } = await registerUser({
    firstName,
    lastName,
    email,
    password
  });

  return response.status(201).json({
    message: "Registration successful. Verify your email to continue.",
    data: toSafeUser(user),
    verificationToken
  });
}

export async function login(request: Request, response: Response) {
  const { email, password } = request.body ?? {};
  if (!email || !password) {
    throw new AppError("Email and password are required.", 400);
  }

  logInfo("auth", "Login request received");
  const { user, accessToken, refreshToken } = await loginUser({ email, password });
  return response.status(200).json({ data: toSafeUser(user), accessToken, refreshToken });
}

export async function googleLogin(request: Request, response: Response) {
  const { idToken } = request.body ?? {};
  if (!idToken) {
    throw new AppError("Google ID token is required.", 400);
  }

  logInfo("auth", "Google login request received");
  const { user, accessToken, refreshToken } = await loginWithGoogle({ idToken });
  return response.status(200).json({ data: toSafeUser(user), accessToken, refreshToken });
}

export async function verifyEmailToken(request: Request, response: Response) {
  const { token } = request.body ?? {};
  if (!token) {
    throw new AppError("Verification token is required.", 400);
  }

  await verifyEmail(token);
  return response.status(200).json({ message: "Email verified successfully." });
}

export async function resendVerificationEmail(request: Request, response: Response) {
  const { email } = request.body ?? {};
  if (!email) {
    throw new AppError("Email is required.", 400);
  }

  const verificationToken = await resendVerification(email);
  return response.status(200).json({
    message: "Verification email resent.",
    verificationToken
  });
}

export async function forgotPassword(request: Request, response: Response) {
  const { email } = request.body ?? {};
  if (!email) {
    throw new AppError("Email is required.", 400);
  }

  const resetToken = await requestPasswordReset(email);
  return response.status(200).json({
    message: "Reset email sent! Check your inbox.",
    resetToken
  });
}

export async function resetPasswordWithToken(request: Request, response: Response) {
  const { token, newPassword } = request.body ?? {};
  if (!token || !newPassword) {
    throw new AppError("Reset token and new password are required.", 400);
  }

  await resetPassword(token, newPassword);
  return response.status(200).json({ message: "Password updated successfully." });
}

export async function refreshSession(request: Request, response: Response) {
  const { refreshToken } = request.body ?? {};
  if (!refreshToken) {
    throw new AppError("Refresh token is required.", 400);
  }

  const { user, accessToken, refreshToken: newRefreshToken } = await refreshAuthSession(refreshToken);
  return response.status(200).json({ data: toSafeUser(user), accessToken, refreshToken: newRefreshToken });
}

export async function logout(request: Request, response: Response) {
  const { refreshToken } = request.body ?? {};
  if (!refreshToken) {
    throw new AppError("Refresh token is required.", 400);
  }

  await logoutAuthSession(refreshToken);
  return response.status(200).json({ message: "Logged out successfully." });
}
