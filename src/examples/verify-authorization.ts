import {
  authorizationHash,
  createAuthorizationEnvelope,
  createHmacAuthorizationSigner,
  evaluateFinancialPolicy,
  financialIntentHash,
  planEnforcementCoverage,
  signAuthorizationEnvelope,
  verifyAuthorizationEnvelope,
} from "../index";
import { exampleNow, examplePolicy, machinePaymentIntent } from "./shared";

export async function verifyAuthorizationExample() {
  const intent = machinePaymentIntent();
  const policy = examplePolicy();
  const decision = evaluateFinancialPolicy({
    intent,
    policy,
    now: exampleNow,
  });
  const coverage = planEnforcementCoverage({
    intent,
    policy,
    matchedRules: decision.matchedRules,
  });
  const envelope = createAuthorizationEnvelope({
    authorizationId: `auth-${intent.intentId}`,
    intent,
    decision,
    coverageReport: coverage,
    nonce: `nonce-${intent.intentId}`,
    idempotencyKey: `idem-${intent.intentId}`,
    issuedAt: exampleNow,
  });
  const signed = await signAuthorizationEnvelope({
    envelope,
    signer: createHmacAuthorizationSigner({
      keyId: "verify-hmac",
      secret: "verify-secret",
    }),
    signedAt: exampleNow,
  });
  const verification = verifyAuthorizationEnvelope({
    envelope: signed,
    intent,
    hmacSecret: "verify-secret",
    expectedKeyId: "verify-hmac",
    selectedProvider: "x402",
    now: new Date("2026-08-18T12:01:00.000Z"),
  });

  return {
    name: "verify-authorization",
    intentHash: financialIntentHash(intent),
    policyDecision: decision.outcome,
    authorizationHash: authorizationHash(signed),
    enforcementCoverage: coverage.coverage.map((item) => ({
      ruleId: item.ruleId,
      level: item.enforcementLevel,
      provider: item.provider,
      result: item.result,
    })),
    verificationStatus: verification.ok ? "verified" : verification.code,
  };
}

if (process.argv[1]?.endsWith("verify-authorization.ts")) {
  verifyAuthorizationExample().then((output) => {
    console.log(JSON.stringify(output, null, 2));
  });
}
