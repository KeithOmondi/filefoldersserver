import { Response } from 'express';

// Small helper so every endpoint replies in the same shape:
// { status: "success", message, data: {...} }
export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  data: T,
  message?: string
): void => {
  res.status(statusCode).json({
    status: 'success',
    message,
    data,
  });
};