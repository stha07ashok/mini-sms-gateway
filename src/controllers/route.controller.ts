import { asyncHandler } from "../utils/asyncHandler.ts";
import { getRouteHealth } from "../services/report.service.ts";

// Collects provider health from reporting service.
export const health = asyncHandler(async (_req, res) => {
  const routes = await getRouteHealth();
  res.json({ success: true, routes });
});
