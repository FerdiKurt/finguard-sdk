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

export class FinancialIntentValidationError extends Error {
  constructor(readonly issues: FinancialIntentValidationIssue[]) {
    super("Invalid financial intent.");
    this.name = "FinancialIntentValidationError";
  }
}

export function createFinancialIntent(
  input: CreateFinancialIntentInput,
): FinancialIntent {
  const intent: FinancialIntent = {
    ...input,
    apiVersion: input.apiVersion ?? "finguard.dev/v1alpha1",
    actor: {
      ...input.actor,
      roles: input.actor.roles ?? [],
    },
    context: {
      ...input.context,
      metadata: input.context.metadata ?? {},
    },
    simulation: input.simulation
      ? {
          success: input.simulation.success,
          valueChanges: input.simulation.valueChanges ?? [],
          riskSignals: input.simulation.riskSignals ?? [],
        }
      : undefined,
    extensions: input.extensions ?? {},
  };
  const validation = validateFinancialIntent(intent);

  if (!validation.valid) {
    throw new FinancialIntentValidationError(validation.issues);
  }

  return validation.intent;
}

export function validateFinancialIntent(
  input: unknown,
): FinancialIntentValidationResult {
  const intent = input as Partial<FinancialIntent>;
  const issues: FinancialIntentValidationIssue[] = [];

  if (!intent || typeof intent !== "object") {
    return {
      valid: false,
      issues: [{ path: "", message: "Financial intent must be an object." }],
    };
  }

  requireString(issues, "intentId", intent.intentId);
  requireString(issues, "organizationId", intent.organizationId);
  requireString(issues, "actor.id", intent.actor?.id);
  if (!["user", "agent", "service"].includes(String(intent.actor?.type))) {
    issues.push({ path: "actor.type", message: "Unsupported actor type." });
  }
  if (!["asset.transfer", "contract.call", "machine.payment"].includes(String(intent.action))) {
    issues.push({ path: "action", message: "Unsupported financial intent action." });
  }
  if (!intent.source?.accountId) {
    issues.push({ path: "source.accountId", message: "Source account is required." });
  }
  if (!["zerodev", "safe", "x402"].includes(String(intent.source?.provider))) {
    issues.push({ path: "source.provider", message: "Unsupported source provider." });
  }
  if (intent.source?.address && !validEvmAddress(intent.source.address)) {
    issues.push({ path: "source.address", message: "Source address is malformed." });
  }
  if (!intent.context?.environment || !["test", "production"].includes(intent.context.environment)) {
    issues.push({ path: "context.environment", message: "Environment is required." });
  }
  if (!validDateTime(intent.requestedAt)) {
    issues.push({ path: "requestedAt", message: "requestedAt must be an ISO date." });
  }

  if (intent.amount !== undefined && !validDecimalString(intent.amount)) {
    issues.push({ path: "amount", message: "Amount must be a non-negative decimal string." });
  }

  if (intent.action === "asset.transfer") {
    if (!intent.destination?.address || !validEvmAddress(intent.destination.address)) {
      issues.push({
        path: "destination.address",
        message: "Asset transfers require a valid destination address.",
      });
    }
    if (!intent.asset?.symbol) {
      issues.push({ path: "asset.symbol", message: "Asset transfers require an asset symbol." });
    }
    if (!intent.amount) {
      issues.push({ path: "amount", message: "Asset transfers require an amount." });
    }
  }

  if (intent.action === "contract.call") {
    if (!intent.destination?.contract || !validEvmAddress(intent.destination.contract)) {
      issues.push({
        path: "destination.contract",
        message: "Contract calls require a valid destination contract.",
      });
    }
  }

  if (intent.action === "machine.payment") {
    if (!intent.destination?.provider && !intent.destination?.counterpartyId) {
      issues.push({
        path: "destination.provider",
        message: "Machine payments require a provider or counterparty.",
      });
    }
    if (!intent.destination?.resource && !intent.destination?.resourceId) {
      issues.push({
        path: "destination.resource",
        message: "Machine payments require a resource or resource ID.",
      });
    }
    if (!intent.asset?.network) {
      issues.push({
        path: "asset.network",
        message: "Machine payments require an asset network.",
      });
    }
    if (!intent.amount) {
      issues.push({ path: "amount", message: "Machine payments require an amount." });
    }
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    intent: {
      ...(intent as FinancialIntent),
      apiVersion: intent.apiVersion ?? "finguard.dev/v1alpha1",
      actor: {
        ...(intent.actor as FinancialIntentActor),
        roles: intent.actor?.roles ?? [],
      },
      context: {
        ...(intent.context as FinancialIntentContext),
        metadata: intent.context?.metadata ?? {},
      },
      extensions: intent.extensions ?? {},
    },
  };
}

export function financialIntentHash(intent: FinancialIntent) {
  return canonicalHash(createFinancialIntent(intent));
}

function requireString(
  issues: FinancialIntentValidationIssue[],
  path: string,
  value: unknown,
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, message: `${path} is required.` });
  }
}
import {
  canonicalHash,
  validDateTime,
  validDecimalString,
  validEvmAddress,
} from "./core-utils";
