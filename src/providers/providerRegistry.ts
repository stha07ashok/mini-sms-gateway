import { Provider } from "../models/index.ts";
import { MockSmsProvider } from "./mockProvider.ts";

// Returns active providers by priority.
// Connects Provider records to failover logic.
export const loadProvidersByPriority = async (): Promise<MockSmsProvider[]> => {
  const records = await Provider.findAll({
    where: { isActive: true },
    order: [
      ["priority", "ASC"],
      ["id", "ASC"],
    ],
  });

  return records.map((record) => new MockSmsProvider(record));
};
