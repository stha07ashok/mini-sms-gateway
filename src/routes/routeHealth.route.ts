import { Router } from "express";
import { health } from "../controllers/route.controller.ts";
import { authenticate } from "../middlewares/auth.middleware.ts";

// Route health route checks provider status for authenticated users.
export const routeHealthRouter = Router();

routeHealthRouter.get("/health", authenticate, health);
