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

export function planEnforcementCoverage(input: {
  intent: FinancialIntent;
  policy: FinancialPolicy;
  matchedRules: FinancialPolicyMatchedRule[];
}): FinancialPolicyCoverageReport {
  const coverage = input.matchedRules.map((rule) =>
    coverageForRule({
      intent: input.intent,
      policy: input.policy,
      rule,
    }),
  );

  return {
    intentId: input.intent.intentId,
    sourceProvider: input.intent.source.provider,
    minimumEnforcement: input.policy.enforcement.minimumEnforcement,
    onUnsupported: input.policy.enforcement.onUnsupported,
    blocksExecution: coverage.some((item) => item.result === "blocks_execution"),
    requiresApproval: coverage.some((item) => item.result === "requires_approval"),
    coverage,
  };
}

function coverageForRule(input: {
  intent: FinancialIntent;
  policy: FinancialPolicy;
  rule: FinancialPolicyMatchedRule;
}): FinancialPolicyEnforcementCoverage {
  const enforcementLevel = enforcementLevelForRule(input.intent.source.provider, input.rule);
  const unsupportedReason = unsupportedReasonFor({
    minimumEnforcement: input.policy.enforcement.minimumEnforcement,
    enforcementLevel,
  });

  return {
    policyId: input.rule.policyId,
    policyVersion: input.rule.policyVersion,
    ruleId: input.rule.ruleId,
    family: input.rule.family,
    enforcementLevel,
    provider:
      enforcementLevel === "GATEWAY" || enforcementLevel === "UNSUPPORTED"
        ? "finguard"
        : input.intent.source.provider,
    mechanism: mechanismForRule(input.intent.source.provider, input.rule),
    unsupportedReason,
    result: enforcementResult({
      onUnsupported: input.policy.enforcement.onUnsupported,
      unsupportedReason,
    }),
  };
}

function enforcementLevelForRule(
  provider: FinancialIntent["source"]["provider"],
  rule: FinancialPolicyMatchedRule,
): FinancialPolicyEnforcementLevel {
  if (rule.effect === "default") {
    return "GATEWAY";
  }

  if (provider === "safe" && rule.family === "approval") {
    return "NATIVE";
  }

  if (
    provider === "zerodev" &&
    ["counterparty", "asset_network", "per_transaction_amount"].includes(
      String(rule.family),
    )
  ) {
    return "NATIVE";
  }

  if (provider === "x402" && ["counterparty", "asset_network"].includes(String(rule.family))) {
    return "NATIVE";
  }

  switch (rule.family) {
    case "actor_role":
    case "counterparty":
    case "asset_network":
    case "per_transaction_amount":
    case "aggregate_spending":
    case "approval":
    case "simulation":
      return "GATEWAY";
    default:
      return "UNSUPPORTED";
  }
}

function mechanismForRule(
  provider: FinancialIntent["source"]["provider"],
  rule: FinancialPolicyMatchedRule,
) {
  if (provider === "safe" && rule.family === "approval") {
    return "Safe owner multisig approval.";
  }

  if (provider === "zerodev" && rule.family === "counterparty") {
    return "ZeroDev session-key recipient permission.";
  }

  if (provider === "zerodev" && rule.family === "per_transaction_amount") {
    return "ZeroDev session-key amount permission.";
  }

  if (provider === "x402" && rule.family === "counterparty") {
    return "x402 provider/resource verification.";
  }

  return "FinGuard gateway policy check before provider execution.";
}

function unsupportedReasonFor(input: {
  minimumEnforcement: FinancialPolicy["enforcement"]["minimumEnforcement"];
  enforcementLevel: FinancialPolicyEnforcementLevel;
}) {
  if (satisfiesMinimum(input.enforcementLevel, input.minimumEnforcement)) {
    return undefined;
  }

  return `Policy requires ${input.minimumEnforcement} enforcement, but this rule is ${input.enforcementLevel}.`;
}

function enforcementResult(input: {
  onUnsupported: FinancialPolicy["enforcement"]["onUnsupported"];
  unsupportedReason: string | undefined;
}): FinancialPolicyEnforcementResult {
  if (!input.unsupportedReason) {
    return "satisfies_policy";
  }

  if (input.onUnsupported === "require_approval") {
    return "requires_approval";
  }

  if (input.onUnsupported === "allow_observation") {
    return "observation_only";
  }

  return "blocks_execution";
}

function satisfiesMinimum(
  level: FinancialPolicyEnforcementLevel,
  minimum: FinancialPolicy["enforcement"]["minimumEnforcement"],
) {
  if (minimum === "observation_allowed") {
    return level !== "UNSUPPORTED";
  }

  if (minimum === "gateway") {
    return level === "GATEWAY" || level === "NATIVE";
  }

  if (minimum === "native_or_gateway") {
    return level === "NATIVE" || level === "GATEWAY";
  }

  return level === "NATIVE";
}
