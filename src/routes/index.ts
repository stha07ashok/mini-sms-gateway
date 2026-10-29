import { Router } from "express";
import { authRouter } from "./auth.route.ts";
import { smsRouter } from "./sms.route.ts";
import { routeHealthRouter } from "./routeHealth.route.ts";

// Routes API endpoints by feature
export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ success: true, message: "Mini SMS Gateway is running" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/sms", smsRouter);
apiRouter.use("/routes", routeHealthRouter);
