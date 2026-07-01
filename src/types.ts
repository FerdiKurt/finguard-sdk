export type FinGuardFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type FinGuardClientOptions = {
  baseUrl: string;
  apiKey?: string;
  fetch?: FinGuardFetch;
};

export type AgentStatus = "active" | "paused";
export type PolicyStatus = "active" | "disabled";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type SafeWalletStatus = "active" | "disabled";
export type SafeWalletMode = "proposal_only";
export type SafeProposalStatus =
  | "proposed"
  | "confirmed"
  | "executed"
  | "failed"
  | "cancelled";

export type SmartAccountStatus = "active" | "disabled";
export type SmartAccountSessionKeyStatus = "active" | "revoked" | "expired";
export type ExecutionMode =
  | "check_only"
  | "relay"
  | "safe_proposal"
  | "zerodev_session_keys";

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

export type SafeWallet = {
  id: string;
  organizationId: string;
  name: string;
  chain: string;
  chainId: number;
  address: string;
  mode: SafeWalletMode;
  status: SafeWalletStatus;
  threshold: number | null;
  owners: string[];
  agentId?: string | null;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
};

export type SafeProposal = {
  id: string;
  organizationId: string;
  agentId: string;
  safeWalletId: string;
  transactionCheckId: string;
  transactionExecutionId: string | null;
  idempotencyKey: string | null;
  safeTxHash: string | null;
  chain: string;
  chainId: number;
  safeAddress: string;
  to: string;
  value: string;
  data: string;
  operation: number;
  status: SafeProposalStatus;
  payloadJson: unknown;
  metadataJson: unknown;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  proposedAt: string | null;
  confirmedAt: string | null;
  executedAt: string | null;
  failedAt: string | null;
};

export type ListSafeProposalFilters = {
  status?: SafeProposalStatus;
  safeWalletId?: string;
  agentId?: string;
};

export type CreateSafeProposalInput = TransactionCheckInput & {
  idempotencyKey: string;
  safeWalletId?: string;
};

export type CreateSafeProposalResponse =
  | {
      status: "proposed";
      decision: PolicyDecision;
      transactionCheckId: string;
      approvalRequestId: null;
      safeProposal: SafeProposal;
    }
  | {
      status: "blocked" | "approval_required";
      decision: PolicyDecision;
      transactionCheckId: string;
      approvalRequestId: string | null;
    }
  | {
      status: SafeProposalStatus;
      safeProposal: SafeProposal;
      transactionCheckId: string;
      idempotentReplay: true;
    };

export type SyncSafeProposalsInput = {
  organizationId: string;
  safeProposalIds?: string[];
  status?: SafeProposalStatus;
  limit?: number;
};

export type SyncSafeProposalsResponse = {
  synced: SafeProposal[];
  skipped: Array<{ safeProposalId: string; reason: string }>;
};

export type GuardedRelayExecutionInput = TransactionCheckInput & {
  idempotencyKey: string;
  relayWalletId?: string;
  dryRun?: boolean;
};

export type SmartAccount = {
  id: string;
  organizationId: string;
  name: string;
  provider: "zerodev";
  chain: "ethereum-sepolia";
  chainId: 11155111;
  address: string;
  status: SmartAccountStatus;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
};

export type CreateSmartAccountInput = {
  organizationId: string;
  name: string;
  provider: "zerodev";
  chain: "ethereum-sepolia";
  chainId: 11155111;
  address: string;
  metadataJson?: Record<string, unknown>;
};

export type SessionPermissionDraft = {
  provider: "zerodev";
  chain: "ethereum-sepolia";
  chainId: 11155111;
  action: "erc20.transfer";
  token: {
    symbol: "USDC";
    address: `0x${string}`;
    decimals: number;
  };
  contractAddress: `0x${string}`;
  functionSelector: `0x${string}`;
  allowedRecipients: `0x${string}`[];
  perTransactionLimit: {
    amount: string;
    amountUnits: string;
    decimals: number;
  };
  validity: {
    validAfter: string | null;
    validUntil: string | null;
  };
  offchainRequiredRules: Array<
    "dailyLimit" | "requiresApprovalAbove" | "dslPolicy" | "unsupportedPolicy"
  >;
  fallbackBehavior: "require_finguard_check";
};

export type SmartAccountSessionKey = {
  id: string;
  organizationId: string;
  smartAccountId: string;
  agentId: string;
  policyId: string | null;
  policyVersionId: string | null;
  publicKey: string;
  keyReference: string | null;
  status: SmartAccountSessionKeyStatus;
  permissionsJson: SessionPermissionDraft | unknown;
  metadataJson: unknown;
  issuedAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IssueSmartAccountSessionKeyInput = {
  organizationId: string;
  smartAccountId: string;
  agentId: string;
  publicKey: string;
  keyReference?: string | null;
  expiresAt: string;
  validAfter?: string | null;
  validUntil?: string | null;
  metadataJson?: Record<string, unknown>;
};

export type ListSmartAccountSessionKeyFilters = {
  smartAccountId?: string;
  agentId?: string;
  status?: SmartAccountSessionKeyStatus;
};

export type RevokeSmartAccountSessionKeyInput = {
  organizationId: string;
  reason?: string;
  revokedBy?: string;
  metadataJson?: Record<string, unknown>;
};

export type SmartAccountSessionKeyRevocation = {
  id: string;
  organizationId: string;
  smartAccountId: string;
  sessionKeyId: string;
  agentId: string;
  reason: string | null;
  revokedBy: string | null;
  metadataJson: unknown;
  createdAt: string;
};

export type ZeroDevUserOperationDraft = {
  provider: "zerodev";
  chain: "ethereum-sepolia";
  chainId: 11155111;
  sender: `0x${string}`;
  sessionKeyId: string;
  sessionPublicKey: `0x${string}`;
  target: `0x${string}`;
  value: string;
  data: `0x${string}`;
  permission: {
    action: "erc20.transfer";
    token: "USDC";
    recipient: `0x${string}`;
    amount: string;
  };
};

export type AccountAbstractionExecutionInput = TransactionCheckInput & {
  idempotencyKey: string;
  smartAccountId: string;
  sessionKeyId: string;
  dryRun?: boolean;
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

export type GuardedRelayExecution = {
  id: string;
  organizationId: string;
  agentId: string;
  transactionCheckId: string;
  smartAccountId?: string | null;
  smartAccountSessionKeyId?: string | null;
  idempotencyKey: string;
  policyId: string | null;
  policyVersionId: string | null;
  action: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
  chain: string;
  token: string;
  amount: string;
  recipient: string;
  txHash: string | null;
  blockNumber: string | null;
  error?: string | null;
  failureReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  failedAt?: string | null;
};


export type AccountAbstractionExecution = GuardedRelayExecution & {
  smartAccountId: string;
  smartAccountSessionKeyId: string;
};

export type AccountAbstractionExecutionResponse =
  | {
      status: "prepared";
      decision: PolicyDecision;
      transactionCheckId: string;
      approvalRequestId: null;
      execution: AccountAbstractionExecution;
      userOperationDraft: ZeroDevUserOperationDraft;
      dryRun: true;
    }
  | {
      status: "submitted";
      decision: PolicyDecision;
      transactionCheckId: string;
      approvalRequestId: null;
      execution: AccountAbstractionExecution;
      userOperationHash: `0x${string}`;
    }
  | {
      status: "failed";
      transactionCheckId: string;
      execution: AccountAbstractionExecution;
    }
  | {
      status: "blocked" | "approval_required";
      decision: PolicyDecision;
      transactionCheckId: string;
      approvalRequestId: string | null;
    }
  | {
      status: AccountAbstractionExecution["status"];
      execution: AccountAbstractionExecution;
      transactionCheckId: string;
      idempotentReplay: true;
    };

export type GuardedRelayUnsignedPayload = {
  chain: string;
  chainId: number;
  to: string;
  value: string;
  data: `0x${string}`;
};

export type GuardedRelayExecutionResponse =
  | {
      status: "prepared";
      decision: PolicyDecision;
      transactionCheckId: string;
      approvalRequestId: null;
      execution: GuardedRelayExecution;
      unsignedPayload: GuardedRelayUnsignedPayload;
      dryRun: true;
    }
  | {
      status: "submitted" | "confirmed";
      decision: PolicyDecision;
      transactionCheckId: string;
      approvalRequestId: null;
      execution: GuardedRelayExecution;
    }
  | {
      status: "failed";
      transactionCheckId: string;
      execution: GuardedRelayExecution;
    }
  | {
      status: "blocked" | "approval_required";
      decision: PolicyDecision;
      transactionCheckId: string;
      approvalRequestId: string | null;
    }
  | {
      status: GuardedRelayExecution["status"];
      execution: GuardedRelayExecution;
      transactionCheckId: string;
      idempotentReplay: true;
    };
