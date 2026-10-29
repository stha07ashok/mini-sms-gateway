import { asyncHandler } from "../utils/asyncHandler.ts";
import { currentUserId } from "../middlewares/auth.middleware.ts";
import { registerUser, loginUser, getProfile } from "../services/auth.service.ts";
import type { RegisterInput, LoginInput } from "../validators/auth.validator.ts";

// Registers users and tokens
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body as RegisterInput;
  const result = await registerUser(name, email, password);
  res.status(201).json({ success: true, ...result });
});

// Checks login and token
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as LoginInput;
  const result = await loginUser(email, password);
  res.json({ success: true, ...result });
});

// Returns current profile
export const me = asyncHandler(async (req, res) => {
  const user = await getProfile(currentUserId(req));
  res.json({ success: true, user });
});
