import { createApp } from "./app.ts";
import { env } from "./config/env.ts";
import { initializeDatabase } from "./dbconnection/db.ts";

// Connects server startup flow
const start = async (): Promise<void> => {
  await initializeDatabase();

  createApp().listen(env.port, () => {
    console.log(`Server running at http://localhost:${env.port}`);
  });
};

start().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
