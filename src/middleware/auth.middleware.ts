// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { AppError } from '../utils/Apperror';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      // For refresh token endpoint
      refreshToken?: string;
    }
  }
}

// Define updated UserRole type
export type UserRole = 'admin' | 'respondent' | 'dr';

// ============================================================
// OPTIONAL AUTH MIDDLEWARE
// Sets req.user if a valid token exists, but continues anonymously if not.
// ============================================================
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
  } catch {
    // Silently proceed for optional auth if token verification fails
  }

  next();
};

// ============================================================
// PROTECT MIDDLEWARE - Verifies Access Token
// ============================================================
export const protect = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('You are not logged in. Please log in to get access.', 401)
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      return next(
        new AppError('Token expired. Please refresh your token.', 401)
      );
    }
    next(new AppError('Invalid token. Please log in again.', 401));
  }
};

// ============================================================
// OPTIONAL REFRESH PROTECT - Allows both access and refresh tokens
// ============================================================
export const protectWithRefresh = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('You are not logged in. Please log in to get access.', 401)
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    try {
      const decoded = verifyRefreshToken(token);
      req.user = decoded;
      req.refreshToken = token;
      next();
    } catch {
      next(new AppError('Invalid token. Please log in again.', 401));
    }
  }
};

// ============================================================
// ROLE-BASED AUTHORIZATION
// ============================================================

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('You are not logged in.', 401));
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return next(
        new AppError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`,
          403
        )
      );
    }

    next();
  };
};

export const adminOnly = requireRole('admin');
export const respondentOnly = requireRole('respondent');
export const adminOrRespondent = requireRole('admin', 'respondent');
export const drOnly = requireRole('dr');
export const adminOrDr = requireRole('admin', 'dr');

// ============================================================
// ADDITIONAL UTILITY MIDDLEWARES
// ============================================================

export const isOwnerOrAdmin = (getResourceUserId: (req: Request) => string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('You are not logged in.', 401));
    }

    if (req.user.role === 'admin') {
      return next();
    }

    const resourceUserId = getResourceUserId(req);
    if (req.user.id !== resourceUserId) {
      return next(
        new AppError('You do not have permission to access this resource.', 403)
      );
    }

    next();
  };
};

export const refreshAccessToken = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Refresh token required.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyRefreshToken(token);
    req.user = decoded;
    req.refreshToken = token;
    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      return next(
        new AppError('Refresh token expired. Please log in again.', 401)
      );
    }
    next(new AppError('Invalid refresh token.', 401));
  }
};