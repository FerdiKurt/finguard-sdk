import type { FinancialIntentAction, FinancialIntentSourceProvider } from "./intents";
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
