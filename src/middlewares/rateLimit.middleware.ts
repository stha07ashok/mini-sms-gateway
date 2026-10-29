import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.ts";

// Limits repeated requests per user
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.rateLimitPerMinute,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user ? `user:${req.user.userId}` : ipKeyGenerator(req.ip ?? ""),
  message: {
    success: false,
    message: `Too many requests, limit is ${env.rateLimitPerMinute} per minute`,
  },
});
