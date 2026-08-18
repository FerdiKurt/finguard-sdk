import { describe, expect, it } from "vitest";

import { blockedProviderExample } from "../src/examples/blocked-provider";
import { universalPolicySafeExample } from "../src/examples/universal-policy-safe";
import { universalPolicyX402Example } from "../src/examples/universal-policy-x402";
import { universalPolicyZeroDevExample } from "../src/examples/universal-policy-zerodev";
import { verifyAuthorizationExample } from "../src/examples/verify-authorization";

describe("SDK core examples", () => {
  it.each([
    ["universal-policy-zerodev", universalPolicyZeroDevExample, "ALLOW"],
    ["universal-policy-safe", universalPolicySafeExample, "ALLOW"],
    ["universal-policy-x402", universalPolicyX402Example, "ALLOW"],
    ["blocked-provider", blockedProviderExample, "BLOCK"],
  ] as const)("runs %s", async (name, runExample, expectedDecision) => {
    const output = await runExample();

    expect(output).toMatchObject({
      name,
      policyDecision: expectedDecision,
    });
    expect(output.intentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(output.authorizationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(output.enforcementCoverage.length).toBeGreaterThan(0);
  });

  it("runs the verification example", async () => {
    await expect(verifyAuthorizationExample()).resolves.toMatchObject({
      name: "verify-authorization",
      policyDecision: "ALLOW",
      verificationStatus: "verified",
    });
  });
});
