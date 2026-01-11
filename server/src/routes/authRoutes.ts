import { Router } from "express";
import {
  forgotPassword,
  googleLogin,
  login,
  register,
  resendVerificationEmail,
  resetPasswordWithToken,
  logout,
  refreshSession,
  verifyEmailToken
} from "../controllers/authController";
import { asyncHandler } from "../middleware/asyncHandler";

export const authRoutes = Router();

authRoutes.post("/auth/register", asyncHandler(register));
authRoutes.post("/auth/login", asyncHandler(login));
authRoutes.post("/auth/google", asyncHandler(googleLogin));
authRoutes.post("/auth/logout", asyncHandler(logout));
authRoutes.post("/auth/refresh", asyncHandler(refreshSession));
authRoutes.post("/auth/verify-email", asyncHandler(verifyEmailToken));
authRoutes.post("/auth/resend-verification", asyncHandler(resendVerificationEmail));
authRoutes.post("/auth/forgot-password", asyncHandler(forgotPassword));
authRoutes.post("/auth/reset-password", asyncHandler(resetPasswordWithToken));
