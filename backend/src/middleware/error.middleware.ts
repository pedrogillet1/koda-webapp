import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import multer from 'multer';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      status: err.statusCode,
    });
  }

  // Handle Multer errors (file upload errors)
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err.message);
    return res.status(400).json({
      error: `Upload error: ${err.message}`,
      status: 400,
    });
  }

  // Handle file filter rejection errors (e.g., system files, unsupported types)
  if (err.message && (err.message.includes('System files not allowed') ||
                      err.message.includes('File type not supported') ||
                      err.message.includes('Unsupported file type'))) {
    console.error('File filter error:', err.message);
    return res.status(400).json({
      error: err.message,
      status: 400,
    });
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      error: 'Database operation failed',
      status: 400,
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message,
      status: 400,
    });
  }

  // Log unexpected errors
  console.error('Unexpected error:', err);

  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return res.status(500).json({
    error: message,
    status: 500,
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
