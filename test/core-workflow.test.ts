import { describe, expect, it } from "vitest";

import {
  createAuthorizationEnvelope,
  createFinancialIntent,
  createHmacAuthorizationSigner,
  evaluateFinancialPolicy,
  financialIntentHash,
  planEnforcementCoverage,
  signAuthorizationEnvelope,
  validateFinancialIntent,
  verifyAuthorizationEnvelope,
  type FinancialIntent,
  type FinancialPolicy,
} from "../src";

const now = new Date("2026-08-18T12:00:00.000Z");

function baseTransferIntent(
  overrides: Partial<FinancialIntent> = {},
): FinancialIntent {
  return createFinancialIntent({
    intentId: "11111111-1111-4111-8111-111111111111",
    organizationId: "org-1",
    actor: {
      id: "agent-1",
      type: "agent",
      roles: ["treasury"],
    },
    action: "asset.transfer",
    source: {
      accountId: "account-1",
      provider: "zerodev",
      address: "0x0000000000000000000000000000000000000001",
    },
    destination: {
      address: "0x0000000000000000000000000000000000000002",
      counterpartyId: "approved-vendor",
    },
    asset: {
      type: "erc20",
      chainId: 11155111,
      symbol: "USDC",
    },
    amount: "100",
    context: {
      environment: "test",
      metadata: {},
    },
    requestedAt: now.toISOString(),
    ...overrides,
  });
}

function policy(): FinancialPolicy {
  return {
    apiVersion: "finguard.dev/v1alpha1",
    kind: "FinancialPolicy",
    metadata: {
      id: "policy-1",
      name: "Universal treasury policy",
      version: "v1",
      status: "published",
    },
    scope: {
      actors: [],
      roles: [],
      accounts: [],
      sourceProviders: [],
      actions: [],
      environments: ["test"],
    },
    enforcement: {
      minimumEnforcement: "gateway",
      onUnsupported: "block",
    },
    rules: [
      {
        id: "blocked-provider",
        family: "counterparty",
        effect: "block",
        reasonCode: "provider.blocked",
        providers: ["blocked.example.com"],
      },
      {
        id: "approved-recipient",
        family: "counterparty",
        effect: "allow",
        reasonCode: "counterparty.allowed",
        recipients: ["approved-vendor"],
      },
      {
        id: "approved-provider",
        family: "counterparty",
        effect: "allow",
        reasonCode: "counterparty.allowed",
        providers: ["api.example.com"],
      },
      {
        id: "large-transfer-approval",
        family: "approval",
        effect: "require_approval",
        reasonCode: "amount.requires_approval",
        whenAmountGreaterThan: "1000",
        requirement: {
          threshold: 1,
          roles: ["owner"],
          expiresInSeconds: 3600,
        },
      },
    ],
    defaults: {
      outcome: "BLOCK",
      reasonCode: "default.block",
      validForSeconds: 300,
    },
  };
}

async function authorize(intent: FinancialIntent) {
  const decision = evaluateFinancialPolicy({
    intent,
    policy: policy(),
    now,
  });
  const coverage = planEnforcementCoverage({
    intent,
    policy: policy(),
    matchedRules: decision.matchedRules,
  });
  const unsigned = createAuthorizationEnvelope({
    authorizationId: `auth-${intent.intentId}`,
    intent,
    decision,
    coverageReport: coverage,
    nonce: `nonce-${intent.intentId}`,
    idempotencyKey: `idem-${intent.intentId}`,
    issuedAt: now,
  });
  const signed = await signAuthorizationEnvelope({
    envelope: unsigned,
    signer: createHmacAuthorizationSigner({
      keyId: "local-hmac",
      secret: "test-secret",
    }),
    signedAt: now,
  });

  return { decision, coverage, signed };
}

describe("standalone core workflow", () => {
  it("runs intent -> policy -> authorization -> verify for ZeroDev transfer", async () => {
    const intent = baseTransferIntent();
    const result = await authorize(intent);

    expect(validateFinancialIntent(intent)).toMatchObject({ valid: true });
    expect(result.decision).toMatchObject({
      outcome: "ALLOW",
      reasonCode: "counterparty.allowed",
      intentHash: financialIntentHash(intent),
    });
    expect(result.coverage.coverage[0]).toMatchObject({
      enforcementLevel: "NATIVE",
      provider: "zerodev",
    });
    expect(
      verifyAuthorizationEnvelope({
        envelope: result.signed,
        intent,
        hmacSecret: "test-secret",
        expectedKeyId: "local-hmac",
        selectedProvider: "zerodev",
        now: new Date("2026-08-18T12:01:00.000Z"),
      }),
    ).toMatchObject({
      ok: true,
      intentHash: financialIntentHash(intent),
    });
  });

  it("supports the same policy for Safe proposal-style transfers", async () => {
    const intent = baseTransferIntent({
      source: {
        accountId: "safe-1",
        provider: "safe",
        address: "0x0000000000000000000000000000000000000003",
      },
    });
    const result = await authorize(intent);

    expect(result.decision.outcome).toBe("ALLOW");
    expect(
      verifyAuthorizationEnvelope({
        envelope: result.signed,
        intent,
        hmacSecret: "test-secret",
        selectedProvider: "safe",
        now: new Date("2026-08-18T12:01:00.000Z"),
      }),
    ).toMatchObject({ ok: true });
  });

  it("supports the same policy for x402 machine payments", async () => {
    const intent = createFinancialIntent({
      intentId: "33333333-3333-4333-8333-333333333333",
      organizationId: "org-1",
      actor: {
        id: "agent-1",
        type: "agent",
        roles: ["treasury"],
      },
      action: "machine.payment",
      source: {
        accountId: "buyer-1",
        provider: "x402",
      },
      destination: {
        provider: "api.example.com",
        counterpartyId: "api.example.com",
        resource: "/paid/resource",
      },
      asset: {
        type: "machine_payment_unit",
        network: "eip155:84532",
        symbol: "USDC",
      },
      amount: "1",
      context: {
        environment: "test",
        metadata: {},
      },
      requestedAt: now.toISOString(),
    });
    const result = await authorize(intent);

    expect(result.decision).toMatchObject({
      outcome: "ALLOW",
      reasonCode: "counterparty.allowed",
    });
    expect(result.coverage.coverage[0]).toMatchObject({
      enforcementLevel: "NATIVE",
      provider: "x402",
    });
  });

  it("keeps blocked providers non-executable", async () => {
    const intent = createFinancialIntent({
      intentId: "44444444-4444-4444-8444-444444444444",
      organizationId: "org-1",
      actor: {
        id: "agent-1",
        type: "agent",
        roles: ["treasury"],
      },
      action: "machine.payment",
      source: {
        accountId: "buyer-1",
        provider: "x402",
      },
      destination: {
        provider: "blocked.example.com",
        counterpartyId: "blocked.example.com",
        resource: "/paid/resource",
      },
      asset: {
        type: "machine_payment_unit",
        network: "eip155:84532",
        symbol: "USDC",
      },
      amount: "1",
      context: {
        environment: "test",
        metadata: {},
      },
      requestedAt: now.toISOString(),
    });
    const result = await authorize(intent);

    expect(result.decision).toMatchObject({
      outcome: "BLOCK",
      reasonCode: "provider.blocked",
    });
    expect(result.signed.executable).toBe(false);
    expect(
      verifyAuthorizationEnvelope({
        envelope: result.signed,
        intent,
        hmacSecret: "test-secret",
        selectedProvider: "x402",
        now: new Date("2026-08-18T12:01:00.000Z"),
      }),
    ).toMatchObject({
      ok: false,
      code: "blocked_not_executable",
    });
  });
});
