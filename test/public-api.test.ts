import { describe, expect, it } from "vitest";

import {
  FinGuardClient,
  type FinancialAuthorizationEnvelope,
  type FinancialExecutionAdapter,
  type FinancialIntent,
  type FinancialPolicy,
  type FinancialPolicyCoverageReport,
  type FinancialPolicyDecision,
} from "../src";

describe("SDK public core API", () => {
  it("exports the existing API client", () => {
    expect(FinGuardClient).toBeTypeOf("function");
  });

  it("exports standalone core types without app imports", () => {
    const intent: FinancialIntent = {
      apiVersion: "finguard.dev/v1alpha1",
      intentId: "intent-1",
      organizationId: "org-1",
      actor: {
        id: "agent-1",
        type: "agent",
        roles: ["treasury"],
      },
      action: "asset.transfer",
      source: {
        accountId: "safe-1",
        provider: "safe",
      },
      destination: {
        address: "0x1111111111111111111111111111111111111111",
      },
      asset: {
        type: "erc20",
        chainId: 11155111,
        symbol: "USDC",
      },
      amount: "1",
      context: {
        environment: "test",
        metadata: {},
      },
      requestedAt: "2026-08-18T12:00:00.000Z",
      extensions: {},
    };

    const policy: FinancialPolicy = {
      apiVersion: "finguard.dev/v1alpha1",
      kind: "FinancialPolicy",
      metadata: {
        id: "policy-1",
        name: "Treasury policy",
        version: "v1",
        status: "published",
      },
      scope: {
        actors: [],
        roles: [],
        accounts: [],
        sourceProviders: ["safe"],
        actions: ["asset.transfer"],
        environments: ["test"],
      },
      enforcement: {
        minimumEnforcement: "gateway",
        onUnsupported: "block",
      },
      rules: [],
      defaults: {
        outcome: "BLOCK",
        reasonCode: "default.block",
        validForSeconds: 300,
      },
    };

    const decision: FinancialPolicyDecision = {
      decisionId: "decision-1",
      outcome: "BLOCK",
      reasonCode: "default.block",
      matchedRules: [],
      validUntil: "2026-08-18T12:05:00.000Z",
      intentHash: "a".repeat(64),
      evaluatedPolicyVersions: [
        {
          policyId: policy.metadata.id,
          policyVersion: policy.metadata.version,
        },
      ],
    };

    const coverage: FinancialPolicyCoverageReport = {
      intentId: intent.intentId,
      sourceProvider: "safe",
      minimumEnforcement: "gateway",
      onUnsupported: "block",
      blocksExecution: false,
      requiresApproval: false,
      coverage: [],
    };

    const envelope: FinancialAuthorizationEnvelope = {
      apiVersion: "finguard.dev/authorization/v1alpha1",
      authorizationId: "auth-1",
      organizationId: intent.organizationId,
      subject: intent.actor,
      issuer: {
        id: "finguard",
        name: "FinGuard",
        environment: "test",
      },
      intentHash: decision.intentHash,
      intentSummary: {
        action: intent.action,
        sourceProvider: "safe",
        sourceAccountId: "safe-1",
        destination: "0x1111111111111111111111111111111111111111",
      },
      decisionId: decision.decisionId,
      decisionOutcome: decision.outcome,
      reasonCode: decision.reasonCode,
      matchedPolicyVersions: decision.evaluatedPolicyVersions,
      matchedRules: [],
      enforcementCoverage: [],
      approvalEvidence: [],
      issuedAt: "2026-08-18T12:00:00.000Z",
      validFrom: "2026-08-18T12:00:00.000Z",
      validUntil: decision.validUntil,
      nonce: "nonce-1",
      idempotencyKey: "idem-1",
      replayScope: {
        scope: "provider",
        provider: "safe",
      },
      executable: false,
      metadata: {},
    };

    const adapter: Pick<FinancialExecutionAdapter, "id"> = {
      id: "mock",
    };

    expect(intent.source.provider).toBe("safe");
    expect(policy.metadata.version).toBe("v1");
    expect(coverage.intentId).toBe("intent-1");
    expect(envelope.authorizationId).toBe("auth-1");
    expect(adapter.id).toBe("mock");
  });
});
