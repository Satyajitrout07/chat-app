import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  const message = err.message || 'Internal Server Error';

  // 403 Forbidden
  if (message.includes('Forbidden') || message.includes('not a member')) {
    res.status(403).json({ error: message });
    return;
  }

  // 404 Not Found
  if (message.includes('not found') || message.includes('NOT_FOUND')) {
    res.status(404).json({ error: message });
    return;
  }

  // 400 Bad Request
  if (
    message.includes('required') ||
    message.includes('cannot be empty') ||
    message.includes('must be different')
  ) {
    res.status(400).json({ error: message });
    return;
  }

  // 401 Unauthorized
  if (message.includes('Unauthorized')) {
    res.status(401).json({ error: message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : message,
  });
}
