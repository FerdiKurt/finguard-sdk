import { createHmac, timingSafeEqual } from "node:crypto";

import { canonicalHash, stableJson } from "./core-utils";
import type { FinancialPolicyCoverageReport } from "./enforcement";
import {
  financialIntentHash,
  type FinancialIntent,
  type FinancialIntentAction,
  type FinancialIntentSourceProvider,
} from "./intents";
import type {
  FinancialPolicyDecision,
  FinancialPolicyDecisionOutcome,
  FinancialPolicyMatchedRule,
} from "./policy";

export type AuthorizationIntentSummary = {
  action: FinancialIntentAction;
  sourceProvider: FinancialIntentSourceProvider;
  sourceAccountId: string;
  sourceAddress?: string;
  destination: string;
  asset?: string;
  amount?: string;
  network?: string;
  calldataSummary?: string;
  resource?: string;
};

export type AuthorizationSignature = {
  algorithm: "ed25519" | "hmac-sha256";
  keyId: string;
  publicKey?: string;
  verifierReference?: string;
  signature: string;
  signedHash: string;
  signedAt: string;
};

export type FinancialAuthorizationEnvelope = {
  apiVersion: "finguard.dev/authorization/v1alpha1";
  authorizationId: string;
  organizationId: string;
  subject: {
    id: string;
    type: "user" | "agent" | "service";
    roles: string[];
  };
  issuer: {
    id: string;
    name: string;
    environment: "development" | "test" | "production";
  };
  intentHash: string;
  intentSummary: AuthorizationIntentSummary;
  decisionId: string;
  decisionOutcome: FinancialPolicyDecisionOutcome;
  reasonCode: string;
  matchedPolicyVersions: FinancialPolicyDecision["evaluatedPolicyVersions"];
  matchedRules: FinancialPolicyMatchedRule[];
  enforcementCoverage: Array<{
    ruleId: string;
    enforcementLevel: "NATIVE" | "GATEWAY" | "OBSERVATION_ONLY" | "UNSUPPORTED";
    provider: string;
    mechanism: string;
    result: "satisfied" | "blocks_execution" | "requires_approval" | "observed";
    unsupportedReason?: string;
  }>;
  requiredApprovals?: FinancialPolicyDecision["requiredApprovals"];
  approvalEvidence: Array<{
    approvalRequestId: string;
    approverId: string;
    approverRole: string;
    decision: "approved" | "rejected";
    decidedAt: string;
    approvalHash: string;
  }>;
  issuedAt: string;
  validFrom: string;
  validUntil: string;
  nonce: string;
  idempotencyKey: string;
  replayScope: {
    scope: "organization" | "subject" | "intent" | "provider";
    provider?: FinancialIntentSourceProvider;
  };
  executable: boolean;
  signature?: AuthorizationSignature;
  metadata: Record<string, unknown>;
};

export type CreateAuthorizationEnvelopeInput = {
  authorizationId: string;
  intent: FinancialIntent;
  decision: FinancialPolicyDecision;
  coverageReport?: FinancialPolicyCoverageReport;
  issuer?: FinancialAuthorizationEnvelope["issuer"];
  nonce: string;
  idempotencyKey: string;
  replayScope?: FinancialAuthorizationEnvelope["replayScope"];
  issuedAt?: Date;
  validFrom?: Date;
  metadata?: Record<string, unknown>;
};

export type AuthorizationSigner = {
  keyId: string;
  algorithm: AuthorizationSignature["algorithm"];
  sign: (input: {
    payload: string;
    hash: string;
    signedAt: string;
  }) => Promise<AuthorizationSignature> | AuthorizationSignature;
};

export type VerifyAuthorizationEnvelopeResult =
  | {
      ok: true;
      envelope: FinancialAuthorizationEnvelope;
      authorizationHash: string;
      intentHash: string;
    }
  | {
      ok: false;
      code:
        | "schema_invalid"
        | "signature_invalid"
        | "intent_hash_mismatch"
        | "not_yet_valid"
        | "expired"
        | "approval_incomplete"
        | "blocked_not_executable"
        | "enforcement_gap"
        | "provider_mismatch";
      reason: string;
    };

export function createAuthorizationEnvelope(
  input: CreateAuthorizationEnvelopeInput,
): FinancialAuthorizationEnvelope {
  const issuedAt = input.issuedAt ?? new Date();
  const validFrom = input.validFrom ?? issuedAt;
  const envelope: FinancialAuthorizationEnvelope = {
    apiVersion: "finguard.dev/authorization/v1alpha1",
    authorizationId: input.authorizationId,
    organizationId: input.intent.organizationId,
    subject: input.intent.actor,
    issuer:
      input.issuer ??
      {
        id: "finguard-sdk",
        name: "FinGuard SDK",
        environment: input.intent.context.environment,
      },
    intentHash: financialIntentHash(input.intent),
    intentSummary: intentSummary(input.intent),
    decisionId: input.decision.decisionId,
    decisionOutcome: input.decision.outcome,
    reasonCode: input.decision.reasonCode,
    matchedPolicyVersions: input.decision.evaluatedPolicyVersions,
    matchedRules: input.decision.matchedRules,
    enforcementCoverage: (input.coverageReport?.coverage ?? []).map((item) => ({
      ruleId: item.ruleId,
      enforcementLevel: item.enforcementLevel,
      provider: item.provider,
      mechanism: item.mechanism,
      result: authorizationCoverageResult(item.result),
      unsupportedReason: item.unsupportedReason,
    })),
    requiredApprovals: input.decision.requiredApprovals,
    approvalEvidence: [],
    issuedAt: issuedAt.toISOString(),
    validFrom: validFrom.toISOString(),
    validUntil: input.decision.validUntil,
    nonce: input.nonce,
    idempotencyKey: input.idempotencyKey,
    replayScope:
      input.replayScope ??
      {
        scope: "provider",
        provider: input.intent.source.provider,
      },
    executable:
      input.decision.outcome === "ALLOW" &&
      !input.coverageReport?.coverage.some((item) => item.result === "blocks_execution"),
    metadata: input.metadata ?? {},
  };

  assertAuthorizationEnvelope(envelope);
  return envelope;
}

export function createHmacAuthorizationSigner(input: {
  keyId: string;
  secret: string;
}): AuthorizationSigner {
  return {
    keyId: input.keyId,
    algorithm: "hmac-sha256",
    sign(signInput) {
      return {
        algorithm: "hmac-sha256",
        keyId: input.keyId,
        verifierReference: `hmac://${input.keyId}`,
        signature: createHmac("sha256", input.secret)
          .update(signInput.payload)
          .digest("base64"),
        signedHash: signInput.hash,
        signedAt: signInput.signedAt,
      };
    },
  };
}

export async function signAuthorizationEnvelope(input: {
  envelope: FinancialAuthorizationEnvelope;
  signer: AuthorizationSigner;
  signedAt?: Date;
}): Promise<FinancialAuthorizationEnvelope> {
  const unsigned = unsignedAuthorizationEnvelope(input.envelope);
  const hash = authorizationHash(unsigned);
  const signature = await input.signer.sign({
    payload: canonicalAuthorizationPayload(unsigned),
    hash,
    signedAt: (input.signedAt ?? new Date()).toISOString(),
  });
  const signed = {
    ...unsigned,
    signature,
  };

  assertAuthorizationEnvelope(signed);
  return signed;
}

export function verifyAuthorizationEnvelope(input: {
  envelope: unknown;
  intent: FinancialIntent;
  hmacSecret?: string;
  expectedKeyId?: string;
  selectedProvider?: FinancialIntentSourceProvider;
  now?: Date;
}): VerifyAuthorizationEnvelopeResult {
  if (!isAuthorizationEnvelope(input.envelope)) {
    return {
      ok: false,
      code: "schema_invalid",
      reason: "Authorization envelope is invalid.",
    };
  }

  const envelope = input.envelope;
  const intentHash = financialIntentHash(input.intent);

  if (envelope.intentHash !== intentHash) {
    return {
      ok: false,
      code: "intent_hash_mismatch",
      reason: "Authorization intent hash does not match supplied intent.",
    };
  }

  const signature = verifyEnvelopeSignature({
    envelope,
    hmacSecret: input.hmacSecret,
    expectedKeyId: input.expectedKeyId,
  });
  if (!signature.ok) {
    return signature;
  }

  const now = input.now ?? new Date();
  if (now.getTime() < Date.parse(envelope.validFrom)) {
    return { ok: false, code: "not_yet_valid", reason: "Authorization is not valid yet." };
  }
  if (now.getTime() > Date.parse(envelope.validUntil)) {
    return { ok: false, code: "expired", reason: "Authorization has expired." };
  }

  if (
    input.selectedProvider &&
    (envelope.intentSummary.sourceProvider !== input.selectedProvider ||
      (envelope.replayScope.provider && envelope.replayScope.provider !== input.selectedProvider))
  ) {
    return {
      ok: false,
      code: "provider_mismatch",
      reason: "Authorization provider binding does not match selected provider.",
    };
  }

  if (envelope.decisionOutcome === "BLOCK" || !envelope.executable) {
    return {
      ok: false,
      code: "blocked_not_executable",
      reason: "Authorization is not executable.",
    };
  }

  if (envelope.decisionOutcome === "REQUIRE_APPROVAL") {
    return {
      ok: false,
      code: "approval_incomplete",
      reason: "SDK verification requires an executable envelope with complete approval evidence.",
    };
  }

  const enforcementGap = envelope.enforcementCoverage.find(
    (item) => item.result === "blocks_execution",
  );
  if (enforcementGap) {
    return {
      ok: false,
      code: "enforcement_gap",
      reason:
        enforcementGap.unsupportedReason ??
        `Authorization enforcement coverage blocks execution for rule ${enforcementGap.ruleId}.`,
    };
  }

  return {
    ok: true,
    envelope,
    authorizationHash: authorizationHash(envelope),
    intentHash,
  };
}

export function authorizationHash(envelope: FinancialAuthorizationEnvelope) {
  return canonicalHash(unsignedAuthorizationEnvelope(envelope));
}

export function canonicalAuthorizationPayload(
  envelope: FinancialAuthorizationEnvelope,
) {
  return stableJson(unsignedAuthorizationEnvelope(envelope));
}

export function unsignedAuthorizationEnvelope(
  envelope: FinancialAuthorizationEnvelope,
): Omit<FinancialAuthorizationEnvelope, "signature"> {
  const { signature: _signature, ...unsigned } = envelope;
  return unsigned;
}

function verifyEnvelopeSignature(input: {
  envelope: FinancialAuthorizationEnvelope;
  hmacSecret?: string;
  expectedKeyId?: string;
}): VerifyAuthorizationEnvelopeResult {
  const signature = input.envelope.signature;
  if (!signature) {
    return { ok: false, code: "signature_invalid", reason: "Authorization is unsigned." };
  }
  if (input.expectedKeyId && signature.keyId !== input.expectedKeyId) {
    return {
      ok: false,
      code: "signature_invalid",
      reason: "Authorization signature key ID does not match.",
    };
  }
  if (signature.signedHash !== authorizationHash(input.envelope)) {
    return {
      ok: false,
      code: "signature_invalid",
      reason: "Authorization signed hash does not match payload.",
    };
  }
  if (signature.algorithm !== "hmac-sha256") {
    return {
      ok: false,
      code: "signature_invalid",
      reason: `Unsupported SDK verification algorithm: ${signature.algorithm}.`,
    };
  }
  if (!input.hmacSecret) {
    return {
      ok: false,
      code: "signature_invalid",
      reason: "HMAC authorization verification requires hmacSecret.",
    };
  }

  const expected = createHmac("sha256", input.hmacSecret)
    .update(canonicalAuthorizationPayload(input.envelope))
    .digest();
  const actual = Buffer.from(signature.signature, "base64");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return {
      ok: false,
      code: "signature_invalid",
      reason: "Authorization signature verification failed.",
    };
  }

  return {
    ok: true,
    envelope: input.envelope,
    authorizationHash: authorizationHash(input.envelope),
    intentHash: input.envelope.intentHash,
  };
}

function intentSummary(intent: FinancialIntent): AuthorizationIntentSummary {
  return {
    action: intent.action,
    sourceProvider: intent.source.provider,
    sourceAccountId: intent.source.accountId,
    sourceAddress: intent.source.address,
    destination:
      intent.destination.address ??
      intent.destination.contract ??
      intent.destination.provider ??
      intent.destination.counterpartyId ??
      intent.destination.resource ??
      "unknown",
    asset: intent.asset?.symbol ?? intent.asset?.address,
    amount: intent.amount,
    network: intent.asset?.network ?? (intent.asset?.chainId ? `eip155:${intent.asset.chainId}` : undefined),
    resource: intent.destination.resource ?? intent.destination.resourceId,
  };
}

function authorizationCoverageResult(
  result: FinancialPolicyCoverageReport["coverage"][number]["result"],
): FinancialAuthorizationEnvelope["enforcementCoverage"][number]["result"] {
  switch (result) {
    case "satisfies_policy":
      return "satisfied";
    case "blocks_execution":
      return "blocks_execution";
    case "requires_approval":
      return "requires_approval";
    case "observation_only":
      return "observed";
  }
}

function assertAuthorizationEnvelope(
  envelope: FinancialAuthorizationEnvelope,
): asserts envelope is FinancialAuthorizationEnvelope {
  if (!isAuthorizationEnvelope(envelope)) {
    throw new Error("Invalid authorization envelope.");
  }
}

function isAuthorizationEnvelope(input: unknown): input is FinancialAuthorizationEnvelope {
  const envelope = input as Partial<FinancialAuthorizationEnvelope>;

  return Boolean(
    envelope &&
      typeof envelope === "object" &&
      envelope.apiVersion === "finguard.dev/authorization/v1alpha1" &&
      typeof envelope.authorizationId === "string" &&
      typeof envelope.organizationId === "string" &&
      typeof envelope.intentHash === "string" &&
      typeof envelope.decisionId === "string" &&
      ["ALLOW", "REQUIRE_APPROVAL", "BLOCK"].includes(String(envelope.decisionOutcome)) &&
      Array.isArray(envelope.matchedPolicyVersions) &&
      Array.isArray(envelope.matchedRules) &&
      Array.isArray(envelope.enforcementCoverage) &&
      Array.isArray(envelope.approvalEvidence) &&
      typeof envelope.executable === "boolean",
  );
}
