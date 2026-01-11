import type { Request, Response, NextFunction, RequestHandler } from "express";

// Wrap async route handlers to forward errors to Express error middleware.
export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown) {
  const wrapped: RequestHandler = (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

  return wrapped;
}
