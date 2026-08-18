import { machinePaymentIntent, printExample, runCoreExample } from "./shared";

export function universalPolicyX402Example() {
  return runCoreExample({
    name: "universal-policy-x402",
    intent: machinePaymentIntent(),
  });
}

if (process.argv[1]?.endsWith("universal-policy-x402.ts")) {
  universalPolicyX402Example().then(printExample);
}
