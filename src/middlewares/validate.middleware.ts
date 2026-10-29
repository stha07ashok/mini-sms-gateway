import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/apiError.ts";

const formatIssues = (error: { issues: { path: PropertyKey[]; message: string }[] }) =>
  error.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    message: issue.message,
  }));

// Validates incoming request payloads
export const validateBody =
  <T>(schema: ZodType<T>): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(ApiError.badRequest("Validation failed", formatIssues(result.error)));
      return;
    }

    req.body = result.data;
    next();
  };

// Validates query string inputs
export const validateQuery =
  <T>(schema: ZodType<T>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(ApiError.badRequest("Validation failed", formatIssues(result.error)));
      return;
    }

    res.locals.query = result.data;
    next();
  };
