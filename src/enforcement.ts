import type { FinancialIntent } from "./intents";
import type { FinancialPolicy, FinancialPolicyMatchedRule } from "./policy";

export type FinancialPolicyEnforcementLevel =
  | "NATIVE"
  | "GATEWAY"
  | "OBSERVATION_ONLY"
  | "UNSUPPORTED";

export type FinancialPolicyEnforcementResult =
  | "satisfies_policy"
  | "blocks_execution"
  | "requires_approval"
  | "observation_only";

export type FinancialPolicyEnforcementCoverage = {
  policyId: string;
  policyVersion: string;
  ruleId: string;
  family?: FinancialPolicyMatchedRule["family"];
  enforcementLevel: FinancialPolicyEnforcementLevel;
  provider: string;
  mechanism: string;
  unsupportedReason?: string;
  result: FinancialPolicyEnforcementResult;
};

export type FinancialPolicyCoverageReport = {
  intentId: string;
  sourceProvider: FinancialIntent["source"]["provider"];
  minimumEnforcement: FinancialPolicy["enforcement"]["minimumEnforcement"];
  onUnsupported: FinancialPolicy["enforcement"]["onUnsupported"];
  blocksExecution: boolean;
  requiresApproval: boolean;
  coverage: FinancialPolicyEnforcementCoverage[];
};
