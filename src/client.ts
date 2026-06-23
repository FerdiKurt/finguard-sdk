export type FinGuardClientOptions = {
  baseUrl: string;
  apiKey?: string;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
};

export type AgentStatus = "active" | "paused";
export type PolicyStatus = "active" | "disabled";
export type ApprovalStatus = "pending" | "approved" | "rejected";

type ApiErrorBody = {
  error?: string | {
    message?: string;
    details?: unknown;
    requestId?: string;
  };
  details?: unknown;
};

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

export type ApprovalActionResponse = {
  approvalRequest: ApprovalRequest;
  transactionCheck: TransactionCheck;
};

export class FinGuardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "FinGuardApiError";
  }
}

export class FinGuardClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchFn: (url: string, init?: RequestInit) => Promise<Response>;

  constructor(options: FinGuardClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetch ?? fetch;
  }

  listAgents(organizationId: string) {
    const searchParams = new URLSearchParams({ organizationId });

    return this.request<{ agents: Agent[] }>(
      `/api/agents?${searchParams.toString()}`,
    );
  }

  createAgent(input: CreateAgentInput) {
    return this.request<{ agent: Agent }>("/api/agents", {
      method: "POST",
      body: input,
    });
  }

  createPolicy(input: CreatePolicyInput) {
    return this.request<{ policy: Policy }>("/api/policies", {
      method: "POST",
      body: input,
    });
  }

  checkTransaction(input: TransactionCheckInput) {
    return this.request<TransactionCheckResponse>("/api/transactions/check", {
      method: "POST",
      body: input,
    });
  }

  listApprovals(organizationId: string) {
    const searchParams = new URLSearchParams({ organizationId });

    return this.request<{ approvals: ApprovalRequest[] }>(
      `/api/approvals?${searchParams.toString()}`,
    );
  }

  approveRequest(id: string) {
    return this.request<ApprovalActionResponse>(
      `/api/approvals/${encodeURIComponent(id)}/approve`,
      {
        method: "POST",
      },
    );
  }

  rejectRequest(id: string) {
    return this.request<ApprovalActionResponse>(
      `/api/approvals/${encodeURIComponent(id)}/reject`,
      {
        method: "POST",
      },
    );
  }

  private async request<TResponse>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PATCH";
      body?: unknown;
    } = {},
  ): Promise<TResponse> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const data = (await response.json()) as TResponse | ApiErrorBody;

    if (!response.ok) {
      const errorBody = data as ApiErrorBody;
      const error = errorBody.error;
      const message =
        typeof error === "string" ? error : error?.message ?? "FinGuard API request failed.";
      const details = typeof error === "string" ? errorBody.details : error?.details;

      throw new FinGuardApiError(
        message,
        response.status,
        details,
      );
    }

    return data as TResponse;
  }
}
