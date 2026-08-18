import { machinePaymentIntent, printExample, runCoreExample } from "./shared";

export function blockedProviderExample() {
  return runCoreExample({
    name: "blocked-provider",
    intent: machinePaymentIntent("blocked.example.com"),
  });
}

if (process.argv[1]?.endsWith("blocked-provider.ts")) {
  blockedProviderExample().then(printExample);
}
