import { printExample, runCoreExample, transferIntent } from "./shared";

export function universalPolicyZeroDevExample() {
  return runCoreExample({
    name: "universal-policy-zerodev",
    intent: transferIntent("zerodev"),
  });
}

if (process.argv[1]?.endsWith("universal-policy-zerodev.ts")) {
  universalPolicyZeroDevExample().then(printExample);
}
