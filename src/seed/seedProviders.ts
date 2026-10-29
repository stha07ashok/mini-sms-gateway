import { sequelize, initializeDatabase } from "../dbconnection/db.ts";
import { Provider } from "../models/index.ts";

// Seeds provider routes for testing.
const PROVIDER_SEED = [
  {
    code: "ROUTE_A",
    name: "Route A (primary, flaky)",
    priority: 1,
    balance: 1000,
    failureRate: 0.3,
    isActive: true,
  },
  {
    code: "ROUTE_B",
    name: "Route B (backup)",
    priority: 2,
    balance: 1000,
    failureRate: 0.1,
    isActive: true,
  },
  {
    code: "ROUTE_C",
    name: "Route C (last resort)",
    priority: 3,
    balance: 500,
    failureRate: 0.05,
    isActive: true,
  },
];

const reset = process.argv.includes("--reset");

// Inserts initial provider data and balances.
const run = async (): Promise<void> => {
  await initializeDatabase();

  for (const seed of PROVIDER_SEED) {
    const [provider, created] = await Provider.findOrCreate({
      where: { code: seed.code },
      defaults: seed,
    });

    if (!created && reset) {
      await provider.update(seed);
    }

    const action = created ? "created" : reset ? "reset" : "kept";
    console.log(
      `${seed.code.padEnd(8)} ${action.padEnd(8)} priority=${provider.priority} balance=${provider.balance} failureRate=${provider.failureRate}`,
    );
  }

  await sequelize.close();
  console.log("Seeding complete.");
};

run().catch((error: unknown) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
