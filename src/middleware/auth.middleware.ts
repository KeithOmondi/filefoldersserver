// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifyRefreshToken, TokenPayload, signAccessToken } from '../utils/jwt';
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
    // Check if it's a token expiration error
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
    // Try access token first
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    // If access token fails, try refresh token
    try {
      const decoded = verifyRefreshToken(token);
      req.user = decoded;
      req.refreshToken = token; // Store for potential rotation
      next();
    } catch (refreshErr) {
      next(new AppError('Invalid token. Please log in again.', 401));
    }
  }
};

// ============================================================
// ROLE-BASED AUTHORIZATION
// ============================================================

// Factory function for role checking
export const requireRole = (...allowedRoles: ('admin' | 'dr')[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('You are not logged in.', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
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

// Convenience role check functions
export const adminOnly = requireRole('admin');
export const drOnly = requireRole('dr');
export const adminOrDr = requireRole('admin', 'dr');

// ============================================================
// ADDITIONAL UTILITY MIDDLEWARES
// ============================================================

// Check if user owns the resource or is admin
export const isOwnerOrAdmin = (getResourceUserId: (req: Request) => string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('You are not logged in.', 401));
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if the user owns the resource
    const resourceUserId = getResourceUserId(req);
    if (req.user.id !== resourceUserId) {
      return next(
        new AppError('You do not have permission to access this resource.', 403)
      );
    }

    next();
  };
};

// Restrict to specific station (for DRs)
export const restrictToStation = (getStationFromRequest: (req: Request) => string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('You are not logged in.', 401));
    }

    // Admin can access any station
    if (req.user.role === 'admin') {
      return next();
    }

    // For DR, check if station matches
    const station = getStationFromRequest(req);
    // In a real app, you'd check this against the user's station
    // For now, we'll just pass through
    
    // TODO: Add station check logic
    next();
  };
};

// ============================================================
// REFRESH TOKEN MIDDLEWARE
// ============================================================

// Verify refresh token and issue new access token
export const refreshAccessToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('Refresh token required.', 401)
    );
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

// ============================================================
// RATE LIMITING BY ROLE (Optional)
// ============================================================

export const rateLimitByRole = (limits: { admin: number; dr: number }) => {
  // This would integrate with a rate limiting library
  // Returns appropriate middleware
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Placeholder for rate limiting logic
    // You'd check the user's role and apply appropriate limits
    next();
  };
};