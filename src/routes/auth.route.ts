import { Router } from "express";
import { register, login, me } from "../controllers/auth.controller.ts";
import { authenticate } from "../middlewares/auth.middleware.ts";
import { validateBody } from "../middlewares/validate.middleware.ts";
import { apiRateLimiter } from "../middlewares/rateLimit.middleware.ts";
import { registerSchema, loginSchema } from "../validators/auth.validator.ts";

// Auth routes connect validation, middleware, and controller logic.
export const authRouter = Router();

authRouter.use(apiRateLimiter);

authRouter.post("/register", validateBody(registerSchema), register);
authRouter.post("/login", validateBody(loginSchema), login);
authRouter.get("/me", authenticate, me);
