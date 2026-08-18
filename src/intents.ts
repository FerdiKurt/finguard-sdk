export type FinancialIntentAction =
  | "asset.transfer"
  | "contract.call"
  | "machine.payment";

export type FinancialIntentSourceProvider = "zerodev" | "safe" | "x402";

export type FinancialIntentActor = {
  id: string;
  type: "user" | "agent" | "service";
  roles: string[];
};

export type FinancialIntentSource = {
  accountId: string;
  provider: FinancialIntentSourceProvider;
  address?: string;
};

export type FinancialIntentDestination = {
  address?: string;
  counterpartyId?: string;
  contract?: string;
  provider?: string;
  resource?: string;
  resourceId?: string;
  settlementAddress?: string;
};

export type FinancialIntentAsset = {
  type: "native" | "erc20" | "machine_payment_unit";
  chainId?: number;
  network?: string;
  address?: string;
  symbol?: string;
};

export type FinancialIntentContext = {
  purpose?: string;
  invoiceId?: string;
  department?: string;
  environment: "test" | "production";
  metadata: Record<string, unknown>;
};

export type FinancialIntentSimulation = {
  success: boolean;
  valueChanges: unknown[];
  riskSignals: string[];
};

export type FinancialIntent = {
  apiVersion: "finguard.dev/v1alpha1";
  intentId: string;
  organizationId: string;
  actor: FinancialIntentActor;
  action: FinancialIntentAction;
  source: FinancialIntentSource;
  destination: FinancialIntentDestination;
  asset?: FinancialIntentAsset;
  amount?: string;
  context: FinancialIntentContext;
  simulation?: FinancialIntentSimulation;
  requestedAt: string;
  extensions: Record<string, unknown>;
};

export type CreateFinancialIntentInput = Omit<
  FinancialIntent,
  "apiVersion" | "extensions"
> & {
  apiVersion?: FinancialIntent["apiVersion"];
  extensions?: Record<string, unknown>;
};

export type FinancialIntentValidationIssue = {
  path: string;
  message: string;
};

export type FinancialIntentValidationResult =
  | {
      valid: true;
      intent: FinancialIntent;
    }
  | {
      valid: false;
      issues: FinancialIntentValidationIssue[];
    };
