import type { TokenPayload } from "../utils/jwt.ts";

// Adds authenticated user data to Express request.
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export {};
