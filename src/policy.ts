import { compareDecimalStrings } from "./core-utils";
import { financialIntentHash, type FinancialIntent, type FinancialIntentAction, type FinancialIntentSourceProvider } from "./intents";

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

export function evaluateFinancialPolicy(input: {
  intent: FinancialIntent;
  policy: FinancialPolicy;
  now?: Date;
}): FinancialPolicyDecision {
  const now = input.now ?? new Date();
  const intentHash = financialIntentHash(input.intent);

  if (!policyApplies(input.policy, input.intent)) {
    return buildDecision({
      now,
      intentHash,
      outcome: "BLOCK",
      reasonCode: "policy.not_applicable",
      validForSeconds: 300,
      matchedRules: [],
      evaluatedPolicyVersions: [],
    });
  }

  const matchedRules = input.policy.rules
    .filter((rule) => ruleMatches(rule, input.intent))
    .map((rule) => matchedRule(input.policy, rule));
  const blockRule = matchedRules.find((rule) => rule.effect === "block");
  const evaluatedPolicyVersions = [
    {
      policyId: input.policy.metadata.id,
      policyVersion: input.policy.metadata.version,
    },
  ];

  if (blockRule) {
    return buildDecision({
      now,
      intentHash,
      outcome: "BLOCK",
      reasonCode: blockRule.reasonCode,
      validForSeconds: input.policy.defaults.validForSeconds,
      matchedRules,
      evaluatedPolicyVersions,
    });
  }

  const approvalRule = input.policy.rules.find(
    (rule) =>
      rule.effect === "require_approval" &&
      rule.family === "approval" &&
      ruleMatches(rule, input.intent),
  );
  if (approvalRule?.family === "approval") {
    return buildDecision({
      now,
      intentHash,
      outcome: "REQUIRE_APPROVAL",
      reasonCode: approvalRule.reasonCode,
      validForSeconds: input.policy.defaults.validForSeconds,
      matchedRules,
      evaluatedPolicyVersions,
      requiredApprovals: {
        threshold: approvalRule.requirement.threshold,
        roles: approvalRule.requirement.roles,
        expiresAt: new Date(
          now.getTime() + approvalRule.requirement.expiresInSeconds * 1000,
        ).toISOString(),
      },
    });
  }

  const allowRule = matchedRules.find((rule) => rule.effect === "allow");
  if (allowRule) {
    return buildDecision({
      now,
      intentHash,
      outcome: "ALLOW",
      reasonCode: allowRule.reasonCode,
      validForSeconds: input.policy.defaults.validForSeconds,
      matchedRules,
      evaluatedPolicyVersions,
    });
  }

  return buildDecision({
    now,
    intentHash,
    outcome: input.policy.defaults.outcome,
    reasonCode: input.policy.defaults.reasonCode,
    validForSeconds: input.policy.defaults.validForSeconds,
    matchedRules: [
      {
        policyId: input.policy.metadata.id,
        policyVersion: input.policy.metadata.version,
        ruleId: "default",
        effect: "default",
        reasonCode: input.policy.defaults.reasonCode,
      },
    ],
    evaluatedPolicyVersions,
  });
}

function buildDecision(input: {
  now: Date;
  intentHash: string;
  outcome: FinancialPolicyDecisionOutcome;
  reasonCode: string;
  validForSeconds: number;
  matchedRules: FinancialPolicyMatchedRule[];
  evaluatedPolicyVersions: FinancialPolicyDecision["evaluatedPolicyVersions"];
  requiredApprovals?: FinancialPolicyDecision["requiredApprovals"];
}): FinancialPolicyDecision {
  return {
    decisionId: `decision:${input.intentHash.slice(0, 32)}:${input.reasonCode}`,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    matchedRules: input.matchedRules,
    requiredApprovals: input.requiredApprovals,
    validUntil: new Date(
      input.now.getTime() + input.validForSeconds * 1000,
    ).toISOString(),
    intentHash: input.intentHash,
    evaluatedPolicyVersions: input.evaluatedPolicyVersions,
  };
}

function policyApplies(policy: FinancialPolicy, intent: FinancialIntent) {
  return (
    includesOrEmpty(policy.scope.actors, intent.actor.id) &&
    overlapsOrEmpty(policy.scope.roles, intent.actor.roles) &&
    includesOrEmpty(policy.scope.accounts, intent.source.accountId) &&
    includesOrEmpty(policy.scope.sourceProviders, intent.source.provider) &&
    includesOrEmpty(policy.scope.actions, intent.action) &&
    includesOrEmpty(policy.scope.environments, intent.context.environment)
  );
}

function ruleMatches(rule: FinancialPolicyRule, intent: FinancialIntent) {
  switch (rule.family) {
    case "actor_role":
      return (
        includesOrEmpty(rule.actors ?? [], intent.actor.id) &&
        includesOrEmpty(rule.actorTypes ?? [], intent.actor.type) &&
        overlapsOrEmpty(rule.roles ?? [], intent.actor.roles)
      );
    case "counterparty":
      return (
        includesOrEmpty(
          rule.recipients ?? [],
          intent.destination.counterpartyId ?? intent.destination.address ?? "",
        ) &&
        includesOrEmpty(rule.providers ?? [], intent.destination.provider ?? "") &&
        includesOrEmpty(rule.contracts ?? [], intent.destination.contract ?? "")
      );
    case "asset_network":
      return (
        includesOrEmpty(rule.symbols ?? [], intent.asset?.symbol ?? "") &&
        includesOrEmpty(
          (rule.chainIds ?? []).map(String),
          intent.asset?.chainId ? String(intent.asset.chainId) : "",
        ) &&
        includesOrEmpty(rule.networks ?? [], intent.asset?.network ?? "")
      );
    case "per_transaction_amount":
      return amountRuleMatches(rule, intent.amount);
    case "aggregate_spending":
      return aggregateRuleMatches(rule, intent.amount);
    case "approval":
      return rule.whenAmountGreaterThan
        ? Boolean(intent.amount && compareDecimalStrings(intent.amount, rule.whenAmountGreaterThan) > 0)
        : true;
    case "simulation":
      return rule.requireSuccess === false ? true : intent.simulation?.success === true;
  }
}

function matchedRule(
  policy: FinancialPolicy,
  rule: FinancialPolicyRule,
): FinancialPolicyMatchedRule {
  return {
    policyId: policy.metadata.id,
    policyVersion: policy.metadata.version,
    ruleId: rule.id,
    family: rule.family,
    effect: rule.effect,
    reasonCode: rule.reasonCode,
  };
}

function amountRuleMatches(
  rule: Extract<FinancialPolicyRule, { family: "per_transaction_amount" }>,
  amount: string | undefined,
) {
  if (!amount) {
    return false;
  }

  return (
    (rule.greaterThan === undefined ||
      compareDecimalStrings(amount, rule.greaterThan) > 0) &&
    (rule.greaterThanOrEqual === undefined ||
      compareDecimalStrings(amount, rule.greaterThanOrEqual) >= 0) &&
    (rule.lessThan === undefined ||
      compareDecimalStrings(amount, rule.lessThan) < 0) &&
    (rule.lessThanOrEqual === undefined ||
      compareDecimalStrings(amount, rule.lessThanOrEqual) <= 0)
  );
}

function aggregateRuleMatches(
  rule: Extract<FinancialPolicyRule, { family: "aggregate_spending" }>,
  amount: string | undefined,
) {
  const spent = rule.spentAmount ?? "0";
  const pending = rule.includePending === false ? "0" : rule.pendingAmount ?? "0";
  const current = amount ?? "0";
  const total = addDecimalStrings(addDecimalStrings(spent, pending), current);

  return compareDecimalStrings(total, rule.limit) > 0;
}

function addDecimalStrings(left: string, right: string) {
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  const scale = 10n ** BigInt(fractionLength);
  const leftUnits =
    BigInt(leftWhole) * scale + BigInt(leftFraction.padEnd(fractionLength, "0") || "0");
  const rightUnits =
    BigInt(rightWhole) * scale +
    BigInt(rightFraction.padEnd(fractionLength, "0") || "0");
  const total = leftUnits + rightUnits;
  const whole = total / scale;
  const fraction = (total % scale).toString().padStart(fractionLength, "0").replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function includesOrEmpty<T extends string>(values: T[], value: string) {
  return values.length === 0 || values.includes(value as T);
}

function overlapsOrEmpty(values: string[], candidates: string[]) {
  return values.length === 0 || candidates.some((candidate) => values.includes(candidate));
}
