import express from "express";
import { apiRouter } from "./routes/index.ts";
import {
  notFoundHandler,
  errorHandler,
} from "./middlewares/error.middleware.ts";

// Main Express app 
export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
