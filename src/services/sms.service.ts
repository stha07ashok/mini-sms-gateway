import { randomUUID } from "node:crypto";
import { Transaction } from "sequelize";
import { sequelize } from "../dbconnection/db.ts";
import {
  Wallet,
  Message,
  SendAttempt,
  CreditTransaction,
} from "../models/index.ts";
import { normalizePhone } from "../utils/phone.ts";
import { segmentMessage } from "../utils/segment.ts";
import { ApiError } from "../utils/apiError.ts";
import { loadProvidersByPriority } from "../providers/providerRegistry.ts";
import { runFailover } from "../providers/failover.ts";

interface AttemptLog {
  route: string;
  attempted: boolean;
  success: boolean;
  error: string | null;
}

interface MessageResult {
  messageId: number;
  to: string;
  status: "sent" | "failed";
  provider: string | null;
  refunded: boolean;
  attempts: AttemptLog[];
}

export interface SendSummary {
  batchId: string;
  encoding: string;
  partsPerMessage: number;
  recipients: number;
  costPerMessage: number;
  totalCharged: number;
  totalRefunded: number;
  creditsRemaining: number;
  summary: { sent: number; failed: number };
  results: MessageResult[];
}

// Validates recipient phone list
const normalizeRecipients = (to: string[]): string[] => {
  const recipients: string[] = [];
  const invalid: { number: unknown; reason: string }[] = [];

  for (const raw of to) {
    const result = normalizePhone(raw);
    if (result.valid) {
      recipients.push(result.normalized);
    } else {
      invalid.push({ number: raw, reason: result.reason });
    }
  }

  if (invalid.length > 0) {
    throw ApiError.badRequest(
      `${invalid.length} of ${to.length} number(s) are invalid`,
      { invalid },
    );
  }

  return recipients;
};

// Charges credits before dispatch
const chargeAndCreateMessages = async (
  userId: number,
  batchId: string,
  recipients: string[],
  body: string,
  encoding: string,
  parts: number,
  totalCost: number,
): Promise<Message[]> =>
  sequelize.transaction(async (tx) => {
    const wallet = await Wallet.findOne({
      where: { userId },
      lock: Transaction.LOCK.UPDATE,
      transaction: tx,
    });

    if (!wallet) throw ApiError.notFound("Wallet not found for this user");

    if (wallet.credits < totalCost) {
      throw ApiError.paymentRequired("Not enough credits for this request", {
        required: totalCost,
        available: wallet.credits,
      });
    }

    const balanceAfter = wallet.credits - totalCost;
    await wallet.update({ credits: balanceAfter }, { transaction: tx });

    const messages: Message[] = [];
    for (const recipient of recipients) {
      messages.push(
        await Message.create(
          {
            userId,
            batchId,
            recipient,
            body,
            encoding,
            parts,
            cost: parts,
            status: "pending",
          },
          { transaction: tx },
        ),
      );
    }

    await CreditTransaction.create(
      {
        userId,
        messageId: null,
        type: "debit",
        amount: totalCost,
        balanceAfter,
        reference: `Batch ${batchId}`,
      },
      { transaction: tx },
    );

    return messages;
  });

// Restores credit on failure
const refundMessage = async (
  messageId: number,
  reason: string,
): Promise<boolean> =>
  sequelize.transaction(async (tx) => {
    const message = await Message.findByPk(messageId, {
      lock: Transaction.LOCK.UPDATE,
      transaction: tx,
    });

    if (!message || message.refunded) return false;

    const wallet = await Wallet.findOne({
      where: { userId: message.userId },
      lock: Transaction.LOCK.UPDATE,
      transaction: tx,
    });

    if (!wallet) return false;

    const balanceAfter = wallet.credits + message.cost;
    await wallet.update({ credits: balanceAfter }, { transaction: tx });

    await message.update(
      { status: "failed", failureReason: reason, refunded: true },
      { transaction: tx },
    );

    await CreditTransaction.create(
      {
        userId: message.userId,
        messageId: message.id,
        type: "refund",
        amount: message.cost,
        balanceAfter,
        reference: "All routes failed",
      },
      { transaction: tx },
    );

    return true;
  });

// Runs provider failover flow
const dispatchMessage = async (message: Message): Promise<MessageResult> => {
  const routes = await loadProvidersByPriority();
  const { deliveredBy, attempts, lastError } = await runFailover(
    routes,
    message.recipient,
    message.parts,
  );

  const called = attempts.filter((attempt) => attempt.attempted);
  if (called.length > 0) {
    await SendAttempt.bulkCreate(
      called.map((attempt) => ({
        messageId: message.id,
        providerId: attempt.routeId,
        success: attempt.success,
        error: attempt.error,
      })),
    );
  }

  const log: AttemptLog[] = attempts.map(({ route, attempted, success, error }) => ({
    route,
    attempted,
    success,
    error,
  }));

  if (deliveredBy) {
    await message.update({
      status: "sent",
      providerId: deliveredBy.id,
      sentAt: new Date(),
      failureReason: null,
    });

    return {
      messageId: message.id,
      to: message.recipient,
      status: "sent",
      provider: deliveredBy.code,
      refunded: false,
      attempts: log,
    };
  }

  const refunded = await refundMessage(message.id, lastError);

  return {
    messageId: message.id,
    to: message.recipient,
    status: "failed",
    provider: null,
    refunded,
    attempts: log,
  };
};

// Sends batches and summary
export const sendSms = async (
  userId: number,
  to: string[],
  body: string,
): Promise<SendSummary> => {
  const recipients = normalizeRecipients(to);

  const { encoding, parts } = segmentMessage(body);
  const totalCost = parts * recipients.length;
  const batchId = randomUUID();

  const messages = await chargeAndCreateMessages(
    userId,
    batchId,
    recipients,
    body,
    encoding,
    parts,
    totalCost,
  );

  const results: MessageResult[] = [];
  for (const message of messages) {
    results.push(await dispatchMessage(message));
  }

  const sent = results.filter((r) => r.status === "sent").length;

  const totalRefunded = results.filter((r) => r.refunded).length * parts;

  const wallet = await Wallet.findOne({ where: { userId } });

  return {
    batchId,
    encoding,
    partsPerMessage: parts,
    recipients: recipients.length,
    costPerMessage: parts,
    totalCharged: totalCost,
    totalRefunded,
    creditsRemaining: wallet?.credits ?? 0,
    summary: { sent, failed: results.length - sent },
    results,
  };
};
