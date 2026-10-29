import { Router } from "express";
import { send, logs } from "../controllers/sms.controller.ts";
import { authenticate } from "../middlewares/auth.middleware.ts";
import {
  validateBody,
  validateQuery,
} from "../middlewares/validate.middleware.ts";
import { apiRateLimiter } from "../middlewares/rateLimit.middleware.ts";
import { sendSmsSchema, logsQuerySchema } from "../validators/sms.validator.ts";

// SMS routes require auth and validation before controller calls.
export const smsRouter = Router();

smsRouter.use(authenticate);
smsRouter.use(apiRateLimiter);
smsRouter.post("/send", validateBody(sendSmsSchema), send);
smsRouter.get("/logs", validateQuery(logsQuerySchema), logs);
