import type {
  Agent,
  ApprovalActionInput,
  ApprovalActionResponse,
  ApprovalRequest,
  CreateAgentInput,
  CreateSafeProposalInput,
  CreateSafeProposalResponse,
  CreatePolicyInput,
  FinGuardClientOptions,
  GuardedRelayExecutionInput,
  GuardedRelayExecutionResponse,
  ListSafeProposalFilters,
  Policy,
  SafeProposal,
  SafeWallet,
  SyncSafeProposalsInput,
  SyncSafeProposalsResponse,
  TransactionCheckInput,
  TransactionCheckResponse,
  UpdateAgentInput,
  UpdatePolicyInput,
} from "./types";

type ApiErrorBody = {
  error?: string | {
    message?: string;
    details?: unknown;
    requestId?: string;
  };
  details?: unknown;
};

export class FinGuardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly body?: unknown,
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

  getAgent(id: string, organizationId: string) {
    const searchParams = new URLSearchParams({ organizationId });

    return this.request<{ agent: Agent }>(
      `/api/agents/${encodeURIComponent(id)}?${searchParams.toString()}`,
    );
  }

  updateAgent(id: string, input: UpdateAgentInput) {
    return this.request<{ agent: Agent }>(
      `/api/agents/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: input,
      },
    );
  }

  createPolicy(input: CreatePolicyInput) {
    return this.request<{ policy: Policy }>("/api/policies", {
      method: "POST",
      body: input,
    });
  }

  listPolicies(organizationId: string) {
    const searchParams = new URLSearchParams({ organizationId });

    return this.request<{ policies: Policy[] }>(
      `/api/policies?${searchParams.toString()}`,
    );
  }

  getPolicy(id: string, organizationId: string) {
    const searchParams = new URLSearchParams({ organizationId });

    return this.request<{ policy: Policy }>(
      `/api/policies/${encodeURIComponent(id)}?${searchParams.toString()}`,
    );
  }

  updatePolicy(id: string, input: UpdatePolicyInput) {
    return this.request<{ policy: Policy }>(
      `/api/policies/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: input,
      },
    );
  }

  checkTransaction(input: TransactionCheckInput) {
    return this.request<TransactionCheckResponse>("/api/transactions/check", {
      method: "POST",
      body: input,
    });
  }

  executeGuardedTransfer(input: GuardedRelayExecutionInput) {
    return this.request<GuardedRelayExecutionResponse>(
      "/api/executions/guarded-transfer",
      {
        method: "POST",
        body: input,
      },
    );
  }

  listSafeWallets(organizationId: string) {
    const searchParams = new URLSearchParams({ organizationId });

    return this.request<{ safeWallets: SafeWallet[] }>(
      `/api/safe-wallets?${searchParams.toString()}`,
    );
  }

  createSafeProposal(input: CreateSafeProposalInput) {
    return this.request<CreateSafeProposalResponse>("/api/safe-proposals", {
      method: "POST",
      body: input,
    });
  }

  listSafeProposals(
    organizationId: string,
    filters: ListSafeProposalFilters = {},
  ) {
    const searchParams = new URLSearchParams({ organizationId });

    if (filters.status) {
      searchParams.set("status", filters.status);
    }

    if (filters.safeWalletId) {
      searchParams.set("safeWalletId", filters.safeWalletId);
    }

    if (filters.agentId) {
      searchParams.set("agentId", filters.agentId);
    }

    return this.request<{ safeProposals: SafeProposal[] }>(
      `/api/safe-proposals/list?${searchParams.toString()}`,
    );
  }

  syncSafeProposals(input: SyncSafeProposalsInput) {
    return this.request<SyncSafeProposalsResponse>("/api/safe-proposals/sync", {
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

  approveRequest(id: string, input?: ApprovalActionInput) {
    return this.request<ApprovalActionResponse>(
      `/api/approvals/${encodeURIComponent(id)}/approve`,
      {
        method: "POST",
        body: input,
      },
    );
  }

  rejectRequest(id: string, input?: ApprovalActionInput) {
    return this.request<ApprovalActionResponse>(
      `/api/approvals/${encodeURIComponent(id)}/reject`,
      {
        method: "POST",
        body: input,
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

    const data = await this.parseResponseBody(response);

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
        data,
      );
    }

    return data as TResponse;
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();

    if (!text) {
      throw new FinGuardApiError(
        "FinGuard API returned an empty response body.",
        response.status,
      );
    }

    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new FinGuardApiError(
        "FinGuard API returned invalid JSON.",
        response.status,
        error,
        text,
      );
    }
  }
}
