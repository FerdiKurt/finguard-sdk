import { printExample, runCoreExample, transferIntent } from "./shared";

export function universalPolicySafeExample() {
  return runCoreExample({
    name: "universal-policy-safe",
    intent: transferIntent("safe"),
  });
}

if (process.argv[1]?.endsWith("universal-policy-safe.ts")) {
  universalPolicySafeExample().then(printExample);
}
