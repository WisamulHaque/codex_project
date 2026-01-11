import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/tokenFactory";
import { AppError } from "../utils/appError";

export function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Authorization token is required.", 401);
  }

  const token = authHeader.replace("Bearer ", "").trim();
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
    next();
  } catch (error) {
    throw new AppError("Invalid or expired token.", 401);
  }
}

export function requireRole(allowedRoles: string[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const role = request.user?.role;
    if (!role) {
      throw new AppError("Unauthorized.", 401);
    }

    if (!allowedRoles.includes(role)) {
      throw new AppError("You do not have permission to perform this action.", 403);
    }

    next();
  };
}
