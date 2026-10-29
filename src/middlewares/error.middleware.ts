import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError.ts";

// Handles missing route responses
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// Standardizes API error responses
export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  console.error("Unhandled error:", error);
  res.status(500).json({ success: false, message: "Internal server error" });
};
