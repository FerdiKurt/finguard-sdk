import {
  authorizationHash,
  createAuthorizationEnvelope,
  createFinancialIntent,
  createHmacAuthorizationSigner,
  evaluateFinancialPolicy,
  financialIntentHash,
  planEnforcementCoverage,
  signAuthorizationEnvelope,
  type FinancialIntent,
  type FinancialPolicy,
} from "../index";

export type CoreExampleOutput = {
  name: string;
  intentHash: string;
  policyDecision: string;
  authorizationHash: string;
  enforcementCoverage: Array<{
    ruleId: string;
    level: string;
    provider: string;
    result: string;
  }>;
};

export const exampleNow = new Date("2026-08-18T12:00:00.000Z");

export function examplePolicy(): FinancialPolicy {
  return {
    apiVersion: "finguard.dev/v1alpha1",
    kind: "FinancialPolicy",
    metadata: {
      id: "provider-independent-demo-policy",
      name: "Provider-independent treasury policy",
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
        reasonCode: "provider.allowed",
        providers: ["api.example.com"],
      },
    ],
    defaults: {
      outcome: "BLOCK",
      reasonCode: "default.block",
      validForSeconds: 300,
    },
  };
}

export function transferIntent(provider: "zerodev" | "safe") {
  return createFinancialIntent({
    intentId:
      provider === "zerodev"
        ? "11111111-1111-4111-8111-111111111111"
        : "22222222-2222-4222-8222-222222222222",
    organizationId: "org-1",
    actor: {
      id: "agent-1",
      type: "agent",
      roles: ["treasury"],
    },
    action: "asset.transfer",
    source: {
      accountId: `${provider}-account-1`,
      provider,
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
    amount: "25",
    context: {
      environment: "test",
      metadata: {},
    },
    requestedAt: exampleNow.toISOString(),
  });
}

export function machinePaymentIntent(provider = "api.example.com") {
  return createFinancialIntent({
    intentId:
      provider === "api.example.com"
        ? "33333333-3333-4333-8333-333333333333"
        : "44444444-4444-4444-8444-444444444444",
    organizationId: "org-1",
    actor: {
      id: "agent-1",
      type: "agent",
      roles: ["treasury"],
    },
    action: "machine.payment",
    source: {
      accountId: "x402-buyer-1",
      provider: "x402",
    },
    destination: {
      provider,
      counterpartyId: provider,
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
    requestedAt: exampleNow.toISOString(),
  });
}

export async function runCoreExample(input: {
  name: string;
  intent: FinancialIntent;
  secret?: string;
}): Promise<CoreExampleOutput> {
  const policy = examplePolicy();
  const decision = evaluateFinancialPolicy({
    intent: input.intent,
    policy,
    now: exampleNow,
  });
  const coverage = planEnforcementCoverage({
    intent: input.intent,
    policy,
    matchedRules: decision.matchedRules,
  });
  const envelope = createAuthorizationEnvelope({
    authorizationId: `auth-${input.intent.intentId}`,
    intent: input.intent,
    decision,
    coverageReport: coverage,
    nonce: `nonce-${input.intent.intentId}`,
    idempotencyKey: `idem-${input.intent.intentId}`,
    issuedAt: exampleNow,
  });
  const signed = await signAuthorizationEnvelope({
    envelope,
    signer: createHmacAuthorizationSigner({
      keyId: "example-hmac",
      secret: input.secret ?? "example-secret",
    }),
    signedAt: exampleNow,
  });

  return {
    name: input.name,
    intentHash: financialIntentHash(input.intent),
    policyDecision: decision.outcome,
    authorizationHash: authorizationHash(signed),
    enforcementCoverage: coverage.coverage.map((item) => ({
      ruleId: item.ruleId,
      level: item.enforcementLevel,
      provider: item.provider,
      result: item.result,
    })),
  };
}

export function printExample(output: CoreExampleOutput) {
  console.log(JSON.stringify(output, null, 2));
}
