import { Op, literal } from "sequelize";
import { Provider } from "../models/index.ts";

export interface SendResult {
  success: boolean;
  error?: string;
}

// Simulates provider delivery and balance changes.
const LATENCY_MS = 30;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Matches Provider model and failover flow.
export class MockSmsProvider {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly priority: number;
  readonly failureRate: number;

  constructor(record: Provider) {
    this.id = record.id;
    this.code = record.code;
    this.name = record.name;
    this.priority = record.priority;
    this.failureRate = record.failureRate;
  }

  async getBalance(): Promise<number> {
    const fresh = await Provider.findByPk(this.id, {
      attributes: ["balance"],
    });
    return fresh?.balance ?? 0;
  }

  async send(recipient: string, parts: number): Promise<SendResult> {
    await sleep(LATENCY_MS);

    if (Math.random() < this.failureRate) {
      return {
        success: false,
        error: `${this.code} rejected the message (simulated ${Math.round(this.failureRate * 100)}% failure)`,
      };
    }

    const [affectedRows] = await Provider.update(
      { balance: literal(`balance - ${Number(parts)}`) },
      { where: { id: this.id, balance: { [Op.gte]: parts } } },
    );

    if (affectedRows === 0) {
      return {
        success: false,
        error: `${this.code} has insufficient balance for ${parts} part(s)`,
      };
    }

    console.log(`[${this.code}] delivered ${parts} part(s) to ${recipient}`);
    return { success: true };
  }
}
