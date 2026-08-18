import type { FinancialIntentAction, FinancialIntentSourceProvider } from "./intents";

export type FinancialPolicyDecisionOutcome =
  | "ALLOW"
  | "REQUIRE_APPROVAL"
  | "BLOCK";

export type FinancialPolicyScope = {
  actors: string[];
  roles: string[];
  accounts: string[];
  sourceProviders: FinancialIntentSourceProvider[];
  actions: FinancialIntentAction[];
  environments: Array<"test" | "production">;
};

export type FinancialPolicyRuleEffect =
  | "allow"
  | "require_approval"
  | "block";

export type FinancialPolicyRuleFamily =
  | "actor_role"
  | "counterparty"
  | "asset_network"
  | "per_transaction_amount"
  | "aggregate_spending"
  | "approval"
  | "simulation";

export type FinancialPolicyRuleBase = {
  id: string;
  family: FinancialPolicyRuleFamily;
  effect: FinancialPolicyRuleEffect;
  reasonCode: string;
  description?: string;
};

export type FinancialPolicyRule =
  | (FinancialPolicyRuleBase & {
      family: "actor_role";
      actors?: string[];
      actorTypes?: Array<"user" | "agent" | "service">;
      roles?: string[];
    })
  | (FinancialPolicyRuleBase & {
      family: "counterparty";
      recipients?: string[];
      providers?: string[];
      contracts?: string[];
    })
  | (FinancialPolicyRuleBase & {
      family: "asset_network";
      symbols?: string[];
      chainIds?: number[];
      networks?: string[];
    })
  | (FinancialPolicyRuleBase & {
      family: "per_transaction_amount";
      greaterThan?: string;
      greaterThanOrEqual?: string;
      lessThan?: string;
      lessThanOrEqual?: string;
    })
  | (FinancialPolicyRuleBase & {
      family: "aggregate_spending";
      window:
        | "rolling_day"
        | "rolling_week"
        | "rolling_month"
        | "calendar_day"
        | "calendar_week"
        | "calendar_month";
      scopes: Array<
        "organization" | "actor" | "account" | "provider" | "recipient" | "asset"
      >;
      limit: string;
      includePending?: boolean;
      spentAmount?: string;
      pendingAmount?: string;
    })
  | (FinancialPolicyRuleBase & {
      family: "approval";
      whenAmountGreaterThan?: string;
      requirement: {
        threshold: number;
        roles: string[];
        expiresInSeconds: number;
      };
    })
  | (FinancialPolicyRuleBase & {
      family: "simulation";
      requireSuccess?: boolean;
      failOnRiskSignals?: string[];
    });

export type FinancialPolicy = {
  apiVersion: "finguard.dev/v1alpha1";
  kind: "FinancialPolicy";
  metadata: {
    id: string;
    name: string;
    version: string;
    status: "draft" | "published" | "archived";
    createdAt?: string;
    publishedAt?: string;
    description?: string;
  };
  scope: FinancialPolicyScope;
  enforcement: {
    minimumEnforcement:
      | "native"
      | "native_or_gateway"
      | "gateway"
      | "observation_allowed";
    onUnsupported: "block" | "require_approval" | "allow_observation";
  };
  rules: FinancialPolicyRule[];
  defaults: {
    outcome: FinancialPolicyDecisionOutcome;
    reasonCode: string;
    validForSeconds: number;
  };
};

export type FinancialPolicyMatchedRule = {
  policyId: string;
  policyVersion: string;
  ruleId: string;
  family?: FinancialPolicyRuleFamily;
  effect: FinancialPolicyRuleEffect | "default";
  reasonCode: string;
};

export type FinancialPolicyDecision = {
  decisionId: string;
  outcome: FinancialPolicyDecisionOutcome;
  reasonCode: string;
  matchedRules: FinancialPolicyMatchedRule[];
  requiredApprovals?: {
    threshold: number;
    roles: string[];
    expiresAt: string;
  };
  validUntil: string;
  intentHash: string;
  evaluatedPolicyVersions: Array<{
    policyId: string;
    policyVersion: string;
  }>;
};
