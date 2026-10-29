import "reflect-metadata";
import { Sequelize } from "sequelize-typescript";
import { env } from "../config/env.ts";
import {
  User,
  Wallet,
  Provider,
  Message,
  SendAttempt,
  CreditTransaction,
} from "../models/index.ts";

// Shared database connection instance
export const sequelize = new Sequelize({
  host: env.db.host,
  port: env.db.port,
  username: env.db.user,
  password: env.db.password,
  database: env.db.database,
  dialect: "mysql",
  // Models are listed explicitly instead of a glob: under ESM the glob form
  // of sequelize-typescript cannot require the files.
  models: [User, Wallet, Provider, Message, SendAttempt, CreditTransaction],
  logging: false,
  ...(env.db.socketPath
    ? { dialectOptions: { socketPath: env.db.socketPath } }
    : {}),
});

// Connects and syncs database
export const initializeDatabase = async (): Promise<void> => {
  await sequelize.authenticate();
  console.log("Database connected successfully.");

  await sequelize.sync({ alter: true });
  console.log("All models were synchronized successfully.");
};
