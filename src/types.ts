export type FinGuardFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type FinGuardClientOptions = {
  baseUrl: string;
  apiKey?: string;
  fetch?: FinGuardFetch;
};

export type AgentStatus = "active" | "paused";
export type PolicyStatus = "active" | "disabled";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type AgentPolicy = {
  maxTransactionAmount: string;
  dailyLimit: string;
  allowedTokens: string[];
  allowedChains: string[];
  allowedRecipients: string[];
  requiresApprovalAbove: string;
};

export type PolicyDslTextField = "action" | "chain" | "token" | "recipient";
export type PolicyDslAmountField = "amount" | "dailySpentAmount" | "dailyTotalAmount";
export type PolicyDslTextOperator = "equals" | "notEquals" | "in" | "notIn";
export type PolicyDslAmountOperator =
  | "equals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual";

export type PolicyDslCondition =
  | {
      field: PolicyDslTextField;
      operator: "equals" | "notEquals";
      value: string;
    }
  | {
      field: PolicyDslTextField;
      operator: "in" | "notIn";
      values: string[];
    }
  | {
      field: PolicyDslAmountField;
      operator: PolicyDslAmountOperator;
      value: string;
    }
  | {
      all: PolicyDslCondition[];
    }
  | {
      any: PolicyDslCondition[];
    }
  | {
      not: PolicyDslCondition;
    };

export type PolicyDslDecision = {
  effect: "allow" | "deny" | "requireApproval";
  reason: string;
  matchedRules?: string[];
};

export type PolicyDsl = {
  version: "1";
  rules: Array<{
    id: string;
    description?: string;
    if: PolicyDslCondition;
    then: PolicyDslDecision;
    else?: PolicyDslDecision;
  }>;
  defaultDecision: PolicyDslDecision;
};

export type PolicyRulesJson =
  | AgentPolicy
  | {
      type: "fixed";
      rules: AgentPolicy;
    }
  | {
      type: "dsl";
      rules: PolicyDsl;
    };

export type CreateAgentInput = {
  organizationId: string;
  name: string;
  description?: string | null;
  status?: AgentStatus;
};

export type UpdateAgentInput = {
  organizationId: string;
  name?: string;
  description?: string | null;
  status?: AgentStatus;
};

export type Agent = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreatePolicyInput = {
  organizationId: string;
  agentId: string;
  name: string;
  status?: PolicyStatus;
  rulesJson: PolicyRulesJson;
};

export type UpdatePolicyInput = {
  organizationId: string;
  agentId?: string;
  name?: string;
  status?: PolicyStatus;
  rulesJson?: PolicyRulesJson;
};

export type Policy = {
  id: string;
  organizationId: string;
  agentId: string;
  name: string;
  status: PolicyStatus;
  rulesJson: PolicyRulesJson;
  createdAt: string;
  updatedAt: string;
};

export type TransactionCheckInput = {
  organizationId: string;
  agentId: string;
  action: string;
  chain: string;
  token: string;
  amount: string;
  recipient: string;
};

export type PolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  matchedRules: string[];
};

export type TransactionCheckResponse = {
  decision: PolicyDecision;
  transactionCheckId: string;
  approvalRequestId: string | null;
};

export type ApprovalRequest = {
  id: string;
  organizationId: string;
  agentId: string;
  transactionCheckId: string;
  status: ApprovalStatus;
  reason: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionCheck = {
  id: string;
  organizationId: string;
  agentId: string;
  policyId: string | null;
  policyVersionId: string | null;
  action: string;
  chain: string;
  token: string;
  amount: string;
  recipient: string;
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  matchedRules: string[];
  createdAt: string;
};

export type ApprovalActionInput = {
  reason?: string;
  approvedBy?: string;
};

export type ApprovalActionResponse = {
  approvalRequest: ApprovalRequest;
  transactionCheck: TransactionCheck;
};
