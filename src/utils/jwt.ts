import jwt, { SignOptions } from "jsonwebtoken";
import { Role } from "../types/roles";

// Fail fast at boot if essential secrets are missing
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET as string;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || ACCESS_TOKEN_SECRET;

// Expiration configurations
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

if (!ACCESS_TOKEN_SECRET) {
  throw new Error("JWT_SECRET or ACCESS_TOKEN_SECRET is not set in environment variables");
}

export interface TokenPayload {
  id: string;
  email: string;
  role: Role;
}

/**
 * Sign a short-lived Access Token (e.g., 15 minutes)
 */
export const signAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  } as SignOptions);
};

/**
 * Sign a long-lived Refresh Token (e.g., 7 days)
 */
export const signRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  } as SignOptions);
};

/**
 * Legacy wrapper to maintain backward compatibility with signToken()
 */
export const signToken = signAccessToken;

/**
 * Verify Access Token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
};

/**
 * Verify Refresh Token
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
};

/**
 * Legacy wrapper to maintain backward compatibility with verifyToken()
 */
export const verifyToken = verifyAccessToken;