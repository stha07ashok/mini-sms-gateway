import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.ts";
import { ApiError } from "./apiError.ts";

export interface TokenPayload {
  userId: number;
  email: string;
}

// Signs JWT for authenticated requests.
export const signToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as SignOptions["expiresIn"],
  });

// Verifies JWT and returns user identity.
export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, env.jwt.secret) as TokenPayload;
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }
};
