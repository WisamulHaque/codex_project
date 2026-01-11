import jwt from "jsonwebtoken";
import { getOptionalEnv, getRequiredEnv } from "../config/env";

export interface TokenPayload {
  userId: string;
  role: string;
  email: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

export function signAccessToken(payload: TokenPayload) {
  const secret = getRequiredEnv("JWT_SECRET");
  const expiresIn = getOptionalEnv("JWT_EXPIRES_IN", "1h");
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyAccessToken(token: string) {
  const secret = getRequiredEnv("JWT_SECRET");
  return jwt.verify(token, secret) as TokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload) {
  const secret = getRequiredEnv("JWT_REFRESH_SECRET");
  const expiresIn = getOptionalEnv("JWT_REFRESH_EXPIRES_IN", "7d");
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyRefreshToken(token: string) {
  const secret = getRequiredEnv("JWT_REFRESH_SECRET");
  return jwt.verify(token, secret) as RefreshTokenPayload;
}
