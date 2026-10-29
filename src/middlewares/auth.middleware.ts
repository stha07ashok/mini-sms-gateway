import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.ts";
import { ApiError } from "../utils/apiError.ts";

// Verifies incoming bearer tokens
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    next(ApiError.unauthorized("Missing Bearer token"));
    return;
  }

  try {
    req.user = verifyToken(header.slice("Bearer ".length).trim());
    next();
  } catch (error) {
    next(error);
  }
};

// Extracts authenticated user ID from request.
export const currentUserId = (req: Request): number => {
  if (!req.user) throw ApiError.unauthorized("Not authenticated");
  return req.user.userId;
};
