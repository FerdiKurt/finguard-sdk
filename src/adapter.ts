import type { FinancialAuthorizationEnvelope } from "./authorization";
import type { FinancialPolicyCoverageReport } from "./enforcement";
import type { FinancialIntent } from "./intents";

export type FinancialExecutionAdapterCapability = {
  supportedActions: FinancialIntent["action"][];
  supportedProviders: FinancialIntent["source"]["provider"][];
  nativeEnforcementFamilies: string[];
  gatewayEnforcementFamilies: string[];
  unsupportedFamilies: string[];
  custodyModel:
    | "customer_custody"
    | "provider_custody"
    | "delegated_session"
    | "no_funds_moved";
  credentialLocation:
    | "customer_connector"
    | "provider"
    | "finguard_testnet"
    | "none";
  supportsRevocation: boolean;
};

export type VerifiedFinancialAuthorization = {
  envelope: FinancialAuthorizationEnvelope;
  authorizationHash: string;
  intentHash: string;
};

export type FinancialExecutionAdapterEvidence = {
  status: "prepared" | "submitted" | "confirmed" | "failed" | "cancelled";
  providerReference?: string;
  txHash?: string;
  userOperationHash?: string;
  safeTxHash?: string;
  metadata?: Record<string, unknown>;
};

export type FinancialExecutionAdapter = {
  id: string;
  validateReadiness: () => Promise<{ ready: true } | { ready: false; reason: string }>;
  declareCapabilities: () => FinancialExecutionAdapterCapability;
  planEnforcement: (intent: FinancialIntent) => Promise<FinancialPolicyCoverageReport>;
  prepareExecution: (input: {
    intent: FinancialIntent;
    authorization: VerifiedFinancialAuthorization;
  }) => Promise<FinancialExecutionAdapterEvidence>;
  executeAuthorizedIntent: (input: {
    intent: FinancialIntent;
    authorization: VerifiedFinancialAuthorization;
  }) => Promise<FinancialExecutionAdapterEvidence>;
  fetchEvidence: (input: {
    authorization: VerifiedFinancialAuthorization;
    providerReference: string;
  }) => Promise<FinancialExecutionAdapterEvidence>;
  revokeAuthorization?: (input: {
    authorization: VerifiedFinancialAuthorization;
    reason?: string;
  }) => Promise<{ revoked: boolean; reason?: string }>;
};
