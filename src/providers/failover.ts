import type { SendResult } from "./mockProvider.ts";

export interface SmsRoute {
  id: number;
  code: string;
  getBalance(): Promise<number>;
  send(recipient: string, parts: number): Promise<SendResult>;
}

export interface RouteAttempt {
  routeId: number;
  route: string;
  attempted: boolean;
  success: boolean;
  error: string | null;
}

export interface FailoverOutcome {
  deliveredBy: SmsRoute | null;
  attempts: RouteAttempt[];
  lastError: string;
}

const NO_ROUTE = "No active route was able to accept the message";

// Tries providers until success
export const runFailover = async (
  routes: SmsRoute[],
  recipient: string,
  parts: number,
): Promise<FailoverOutcome> => {
  const attempts: RouteAttempt[] = [];
  let lastError = NO_ROUTE;

  for (const route of routes) {
    if ((await route.getBalance()) < parts) {
      attempts.push({
        routeId: route.id,
        route: route.code,
        attempted: false,
        success: false,
        error: `Skipped: balance below ${parts} part(s)`,
      });
      continue;
    }

    const result = await route.send(recipient, parts);

    attempts.push({
      routeId: route.id,
      route: route.code,
      attempted: true,
      success: result.success,
      error: result.error ?? null,
    });

    if (result.success) {
      return { deliveredBy: route, attempts, lastError };
    }

    lastError = result.error ?? lastError;
  }

  return { deliveredBy: null, attempts, lastError };
};
