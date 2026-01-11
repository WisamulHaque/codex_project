import crypto from "crypto";
import { UserModel, type UserDocument } from "../models/userModel";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";
import { hashPassword, verifyPassword } from "../utils/passwordUtils";
import { ensureStrongPassword } from "../utils/passwordPolicy";
import { sendPasswordResetEmail, sendVerificationEmail } from "./emailService";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type RefreshTokenPayload,
  type TokenPayload
} from "../utils/tokenFactory";

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: "admin" | "manager" | "employee";
}

interface LoginInput {
  email: string;
  password: string;
}

interface GoogleLoginInput {
  idToken: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildAccessToken(user: UserDocument) {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    role: user.role,
    email: user.email
  };

  return signAccessToken(payload);
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getExpiry(hours = 24) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function issueTokens(user: UserDocument) {
  const refreshTokenId = crypto.randomUUID();
  const refreshPayload: RefreshTokenPayload = {
    userId: user._id.toString(),
    tokenId: refreshTokenId
  };

  user.refreshTokenId = refreshTokenId;
  user.refreshTokenExpires = getExpiry(24 * 7);

  return {
    accessToken: buildAccessToken(user),
    refreshToken: signRefreshToken(refreshPayload)
  };
}

export async function registerUser(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    throw new AppError("This email is already in use. Try logging in instead.", 409);
  }

  ensureStrongPassword(input.password);
  const passwordHash = await hashPassword(input.password);
  const verificationToken = generateToken();

  const user = await UserModel.create({
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email,
    passwordHash,
    role: input.role ?? "employee",
    isEmailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: getExpiry(24)
  });

  logInfo("auth", `Registered user ${user.email}`);
  await sendVerificationEmail(user.email, verificationToken);

  return {
    user,
    verificationToken
  };
}

export async function loginUser(input: LoginInput) {
  const email = normalizeEmail(input.email);
  const user = await UserModel.findOne({ email });
  if (!user || !user.passwordHash) {
    throw new AppError("No account found with this email.", 404);
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new AppError("Incorrect password. Please try again.", 401);
  }

  if (!user.isEmailVerified) {
    throw new AppError("Please verify your email to continue.", 403);
  }

  const tokens = issueTokens(user);
  await user.save();
  logInfo("auth", `User ${user.email} logged in`);

  return { user, ...tokens };
}

export async function verifyEmail(token: string) {
  const user = await UserModel.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() }
  });

  if (!user) {
    throw new AppError("Verification token is invalid or expired.", 400);
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  logInfo("auth", `Email verified for ${user.email}`);
  return user;
}

export async function resendVerification(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const user = await UserModel.findOne({ email });
  if (!user) {
    throw new AppError("No account found with this email.", 404);
  }

  if (user.isEmailVerified) {
    throw new AppError("Email is already verified.", 400);
  }

  const verificationToken = generateToken();
  user.emailVerificationToken = verificationToken;
  user.emailVerificationExpires = getExpiry(24);
  await user.save();

  logInfo("auth", `Verification resent to ${user.email}`);
  await sendVerificationEmail(user.email, verificationToken);
  return verificationToken;
}

export async function requestPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const user = await UserModel.findOne({ email });
  if (!user) {
    throw new AppError("No account found with this email.", 404);
  }

  const resetToken = generateToken();
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = getExpiry(2);
  await user.save();

  logInfo("auth", `Password reset requested for ${user.email}`);
  await sendPasswordResetEmail(user.email, resetToken);
  return resetToken;
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await UserModel.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() }
  });

  if (!user) {
    throw new AppError("Reset token is invalid or expired.", 400);
  }

  ensureStrongPassword(newPassword);
  user.passwordHash = await hashPassword(newPassword);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenId = undefined;
  user.refreshTokenExpires = undefined;
  await user.save();

  logInfo("auth", `Password reset for ${user.email}`);
  return user;
}

async function verifyGoogleIdToken(idToken: string) {
  const { OAuth2Client } = await import("google-auth-library");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new AppError("Google auth is not configured.", 500);
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();

  if (!payload?.email || !payload.sub) {
    throw new AppError("Unable to validate Google login.", 401);
  }

  const nameParts = (payload.name ?? "").trim().split(" ");
  return {
    email: payload.email,
    googleId: payload.sub,
    firstName: nameParts[0] || "Google",
    lastName: nameParts.slice(1).join(" ") || "User"
  };
}

export async function loginWithGoogle(input: GoogleLoginInput) {
  const googleProfile = await verifyGoogleIdToken(input.idToken);
  const email = normalizeEmail(googleProfile.email);

  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    if (!existingUser.googleId) {
      existingUser.googleId = googleProfile.googleId;
    }
    existingUser.isEmailVerified = true;
    const tokens = issueTokens(existingUser);
    await existingUser.save();
    return { user: existingUser, ...tokens };
  }

  const user = await UserModel.create({
    firstName: googleProfile.firstName,
    lastName: googleProfile.lastName,
    email,
    googleId: googleProfile.googleId,
    role: "employee",
    isEmailVerified: true
  });

  const tokens = issueTokens(user);
  await user.save();
  logInfo("auth", `Google login created ${user.email}`);
  return { user, ...tokens };
}

export async function refreshSession(refreshToken: string) {
  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError("Refresh token is invalid or expired.", 401);
  }

  const user = await UserModel.findById(payload.userId);
  if (!user || !user.refreshTokenId || user.refreshTokenId !== payload.tokenId) {
    throw new AppError("Refresh token is invalid or expired.", 401);
  }

  const tokens = issueTokens(user);
  await user.save();

  return { user, ...tokens };
}

export async function logoutSession(refreshToken: string) {
  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError("Refresh token is invalid or expired.", 401);
  }

  const user = await UserModel.findById(payload.userId);
  if (user && user.refreshTokenId === payload.tokenId) {
    user.refreshTokenId = undefined;
    user.refreshTokenExpires = undefined;
    await user.save();
  }

  logInfo("auth", "Refresh token revoked");
  return true;
}
