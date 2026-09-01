import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/Apperror';

// Extend Express Request type to include validated data
declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
    }
  }
}

export const validate = (schema: ZodSchema) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Determine what to validate based on the HTTP method
  const dataToValidate = req.method === 'GET' ? req.query : req.body;

  const result = schema.safeParse(dataToValidate);

  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid request data.';
    return next(new AppError(message, 400));
  }

  // Store validated data on req.validatedData (not trying to reassign req.query)
  req.validatedData = result.data;
  
  next();
};