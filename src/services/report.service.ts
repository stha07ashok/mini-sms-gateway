import { Op } from "sequelize";
import type { WhereOptions } from "sequelize";
import { Message, Provider, SendAttempt } from "../models/index.ts";
import type { MessageStatus } from "../models/message.model.ts";
import { normalizePhone } from "../utils/phone.ts";
import { ApiError } from "../utils/apiError.ts";
import { env } from "../config/env.ts";

const MAX_PAGE_SIZE = 100;
const HOURS_24_MS = 24 * 60 * 60 * 1000;

export interface LogFilters {
  status?: MessageStatus;
  number?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

const parseDate = (value: string, label: string, endOfDay: boolean): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`Invalid ${label} date: ${value}`);
  }
  if (endOfDay && !value.includes("T")) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

// Fetches user message history
export const getMessageLogs = async (userId: number, filters: LogFilters) => {
  const page = Math.max(1, filters.page);
  const limit = Math.min(Math.max(1, filters.limit), MAX_PAGE_SIZE);

  const where: WhereOptions = { userId };

  if (filters.status) {
    Object.assign(where, { status: filters.status });
  }

  if (filters.number) {
    const phone = normalizePhone(filters.number);
    if (!phone.valid) {
      throw ApiError.badRequest(`Invalid number filter: ${phone.reason}`);
    }
    Object.assign(where, { recipient: phone.normalized });
  }

  if (filters.from || filters.to) {
    Object.assign(where, {
      createdAt: {
        ...(filters.from
          ? { [Op.gte]: parseDate(filters.from, "from", false) }
          : {}),
        ...(filters.to ? { [Op.lte]: parseDate(filters.to, "to", true) } : {}),
      },
    });
  }

  const { rows, count } = await Message.findAndCountAll({
    where,
    include: [{ model: Provider, attributes: ["code", "name"] }],
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit) || 1,
    },
    data: rows.map((message) => ({
      id: message.id,
      batchId: message.batchId,
      to: message.recipient,
      body: message.body,
      encoding: message.encoding,
      parts: message.parts,
      cost: message.cost,
      status: message.status,
      provider: message.provider?.code ?? null,
      failureReason: message.failureReason,
      refunded: message.refunded,
      sentAt: message.sentAt,
      createdAt: message.createdAt,
    })),
  };
};

// Scores provider health metrics
export const getRouteHealth = async () => {
  const providers = await Provider.findAll({
    order: [
      ["priority", "ASC"],
      ["id", "ASC"],
    ],
  });

  const since = new Date(Date.now() - HOURS_24_MS);

  return Promise.all(
    providers.map(async (provider) => {
      const window = { providerId: provider.id, createdAt: { [Op.gte]: since } };

      const total = await SendAttempt.count({ where: window });
      const succeeded = await SendAttempt.count({
        where: { ...window, success: true },
      });

      const successRate = total === 0 ? 1 : succeeded / total;
      const balanceScore = Math.min(
        provider.balance / env.healthyProviderBalance,
        1,
      );

      const usable = provider.isActive && provider.balance > 0;
      const health = usable
        ? Math.round((0.7 * successRate + 0.3 * balanceScore) * 100)
        : 0;

      return {
        code: provider.code,
        name: provider.name,
        priority: provider.priority,
        isActive: provider.isActive,
        balance: provider.balance,
        configuredFailureRate: provider.failureRate,
        last24h: {
          attempts: total,
          succeeded,
          failed: total - succeeded,
          successRate: total === 0 ? null : Math.round(successRate * 100),
        },
        balanceScore: Math.round(balanceScore * 100),
        health,
      };
    }),
  );
};
