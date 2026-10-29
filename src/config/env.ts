import dotenv from "dotenv";

dotenv.config();

// Loads env values and defaults.
// Used by server, JWT, and rate limit config.
const read = (key: string, fallback?: string): string => {
  const value = process.env[key]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
};

// Reads numeric env values safely.
const readNumber = (key: string, fallback: number): number => {
  const value = Number(process.env[key]?.trim());
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const env = {
  port: readNumber("PORT", 3000),

  db: {
    host: read("DB_HOST", "127.0.0.1"),
    port: readNumber("DB_PORT", 3306),
    user: read("DB_USER", "root"),
    password: read("DB_PASSWORD", ""),
    database: read("DB_DATABASE", "mini-sms-gateway"),
    socketPath: process.env.DB_SOCKET_PATH?.trim(),
  },

  jwt: {
    secret: read("JWT_SECRET", "dev-only-change-me"),
    expiresIn: read("JWT_EXPIRES_IN", "1d"),
  },

  // Credits handed to a new account so the API is usable right after register. 
  signupCredits: readNumber("SIGNUP_CREDITS", 100),

  // Requests per minute per user, used by the rate limiter (bonus B2). 
  rateLimitPerMinute: readNumber("RATE_LIMIT_PER_MINUTE", 60),

  
  // Provider balance (in SMS parts) that counts as "fully stocked" when
  //scoring route health. See README -> Route health formula.
   
  healthyProviderBalance: readNumber("HEALTHY_PROVIDER_BALANCE", 1000),
} as const;
