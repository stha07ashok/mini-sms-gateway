import bcrypt from "bcryptjs";
import { sequelize } from "../dbconnection/db.ts";
import { User, Wallet, CreditTransaction } from "../models/index.ts";
import { env } from "../config/env.ts";
import { ApiError } from "../utils/apiError.ts";
import { signToken } from "../utils/jwt.ts";

const SALT_ROUNDS = 10;

export interface AuthResult {
  token: string;
  user: { id: number; name: string; email: string; credits: number };
}

// Creates user and wallet
export const registerUser = async (
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await sequelize.transaction(async (tx) => {
    const created = await User.create(
      { name, email, password: hash },
      { transaction: tx },
    );

    await Wallet.create(
      { userId: created.id, credits: env.signupCredits },
      { transaction: tx },
    );

    await CreditTransaction.create(
      {
        userId: created.id,
        messageId: null,
        type: "signup",
        amount: env.signupCredits,
        balanceAfter: env.signupCredits,
        reference: "Signup bonus",
      },
      { transaction: tx },
    );

    return created;
  });

  return {
    token: signToken({ userId: user.id, email: user.email }),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      credits: env.signupCredits,
    },
  };
};

// Verifies credentials and token
export const loginUser = async (
  email: string,
  password: string,
): Promise<AuthResult> => {
  const user = await User.findOne({
    where: { email },
    include: [{ model: Wallet }],
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  return {
    token: signToken({ userId: user.id, email: user.email }),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      credits: user.wallet?.credits ?? 0,
    },
  };
};

// Loads user credit snapshot
export const getProfile = async (userId: number): Promise<AuthResult["user"]> => {
  const user = await User.findByPk(userId, { include: [{ model: Wallet }] });
  if (!user) throw ApiError.notFound("User not found");

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    credits: user.wallet?.credits ?? 0,
  };
};
