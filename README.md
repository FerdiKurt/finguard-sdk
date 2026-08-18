# @finguard/sdk

TypeScript SDK for FinGuard policy checks and approval workflows.

FinGuard helps applications evaluate transaction intent against organization and
agent policies before execution. The SDK provides a typed client for creating
agents and policies, checking transactions, and handling approval requests.

It also includes a standalone provider-independent core for local validation:

```text
FinancialIntent
  -> FinancialPolicy decision
  -> enforcement coverage
  -> signed authorization envelope
  -> adapter/connector verification
```

The standalone core does not require the dashboard, API server, database, wallet
keys, RPC endpoints, or payment credentials.

## Installation

```bash
pnpm add @finguard/sdk
```

## Safety Model

The SDK is a policy and authorization client, not a wallet, custodian, spending
signer, or transaction broadcaster. It can evaluate and sign FinGuard
authorization evidence, but that signature authorizes a FinGuard policy result,
not blockchain spending by itself.

Execution stays with wallet, Safe, account-abstraction, payment, or
customer-hosted connector infrastructure. Provider adapters should verify the
authorization envelope before moving money or creating proposals.

Every financial tool exposed to an AI agent must call FinGuard before touching a
wallet or execution service. Do not expose a raw wallet, token transfer,
custodian, or blockchain broadcast tool beside the guarded tool. If an agent has
both a guarded tool and an unguarded wallet tool, it can bypass FinGuard.

The correct boundary is:

1. Agent proposes a financial action.
2. Your tool calls FinGuard with the exact action details.
3. FinGuard returns or builds a decision bound to that exact intent.
4. Your tool creates or receives a signed authorization envelope.
5. Your connector verifies the envelope against the supplied intent.
6. Your tool stops when FinGuard blocks, requires missing approval, or
   verification fails.
7. Your tool executes only after successful verification.

For hosted relay flows, prefer `executeGuardedTransfer` over exposing a wallet
tool directly. The relay endpoint performs the FinGuard check and creates the
execution record in one idempotent API call. Your agent should receive only this
guarded tool, not a separate unrestricted wallet, private-key, or RPC broadcast
tool.

## Basic Usage

```ts
import { createFinGuardGuardedAction, FinGuardClient } from "@finguard/sdk";

const finGuard = new FinGuardClient({
  baseUrl: "https://your-finguard-api.com",
  apiKey: process.env.FINGUARD_API_KEY
});

async function sendUsdc(input: {
  chain: string;
  token: string;
  amount: string;
  recipient: string;
}) {
  // Call your wallet, custodian, or execution service here.
  return { submitted: true, chain: input.chain };
}

const guardedPayment = createFinGuardGuardedAction(finGuard, sendUsdc);

const result = await guardedPayment({
  organizationId: "org-id",
  agentId: "agent-id",
  action: "transfer",
  chain: "ethereum-sepolia",
  token: "USDC",
  amount: "1",
  recipient: "0x1111111111111111111111111111111111111111"
});

if (result.status === "blocked") {
  console.log({
    reason: result.decision.reason,
    matchedRules: result.decision.matchedRules,
    transactionCheckId: result.transactionCheckId,
    approvalRequestId: result.approvalRequestId
  });
}
```

Blocked and approval-required decisions both return `status: "blocked"` and do
not call your wallet executor. Approval-required results include
`approvalRequestId`.

## Provider-Independent Core

Use the core helpers when you want to run FinGuard's authorization model without
starting the hosted API or dashboard:

```ts
import {
  createAuthorizationEnvelope,
  createFinancialIntent,
  createHmacAuthorizationSigner,
  evaluateFinancialPolicy,
  planEnforcementCoverage,
  signAuthorizationEnvelope,
  verifyAuthorizationEnvelope,
  type FinancialPolicy
} from "@finguard/sdk";

const intent = createFinancialIntent({
  intentId: "intent-1",
  organizationId: "org-1",
  actor: {
    id: "agent-1",
    type: "agent",
    roles: ["treasury"]
  },
  action: "asset.transfer",
  source: {
    accountId: "safe-1",
    provider: "safe",
    address: "0x0000000000000000000000000000000000000001"
  },
  destination: {
    address: "0x0000000000000000000000000000000000000002",
    counterpartyId: "approved-vendor"
  },
  asset: {
    type: "erc20",
    chainId: 11155111,
    symbol: "USDC"
  },
  amount: "25",
  context: {
    environment: "test",
    metadata: {}
  },
  requestedAt: new Date().toISOString()
});

const policy: FinancialPolicy = {
  apiVersion: "finguard.dev/v1alpha1",
  kind: "FinancialPolicy",
  metadata: {
    id: "policy-1",
    name: "Treasury policy",
    version: "v1",
    status: "published"
  },
  scope: {
    actors: [],
    roles: [],
    accounts: [],
    sourceProviders: ["safe"],
    actions: ["asset.transfer"],
    environments: ["test"]
  },
  enforcement: {
    minimumEnforcement: "gateway",
    onUnsupported: "block"
  },
  rules: [
    {
      id: "approved-vendor",
      family: "counterparty",
      effect: "allow",
      reasonCode: "counterparty.allowed",
      recipients: ["approved-vendor"]
    }
  ],
  defaults: {
    outcome: "BLOCK",
    reasonCode: "default.block",
    validForSeconds: 300
  }
};

const decision = evaluateFinancialPolicy({ intent, policy });
const coverage = planEnforcementCoverage({
  intent,
  policy,
  matchedRules: decision.matchedRules
});

const unsignedEnvelope = createAuthorizationEnvelope({
  authorizationId: "auth-1",
  intent,
  decision,
  coverageReport: coverage,
  nonce: "nonce-1",
  idempotencyKey: "invoice-123"
});

const signedEnvelope = await signAuthorizationEnvelope({
  envelope: unsignedEnvelope,
  signer: createHmacAuthorizationSigner({
    keyId: "local-dev-key",
    secret: process.env.FINGUARD_AUTHORIZATION_SECRET ?? "dev-secret"
  })
});

const verification = verifyAuthorizationEnvelope({
  envelope: signedEnvelope,
  intent,
  hmacSecret: process.env.FINGUARD_AUTHORIZATION_SECRET ?? "dev-secret",
  expectedKeyId: "local-dev-key",
  selectedProvider: "safe"
});

if (!verification.ok) {
  throw new Error(verification.reason);
}
```

The local HMAC signer is for development and self-hosted demos. Production
connectors should use a key-management boundary appropriate for the deployment
model and should treat unsigned, expired, tampered, provider-mismatched, blocked,
or approval-incomplete envelopes as non-executable.

The core helpers are deterministic and side-effect-free by default:

- `createFinancialIntent`
- `validateFinancialIntent`
- `evaluateFinancialPolicy`
- `planEnforcementCoverage`
- `createAuthorizationEnvelope`
- `signAuthorizationEnvelope`
- `verifyAuthorizationEnvelope`

## Core Examples

The repository includes small examples under `src/examples`:

- `universal-policy-zerodev.ts`
- `universal-policy-safe.ts`
- `universal-policy-x402.ts`
- `blocked-provider.ts`
- `verify-authorization.ts`

Each example returns or prints:

- intent hash
- policy decision
- authorization hash
- enforcement coverage

Run the covered example tests:

```bash
pnpm test
```

The examples intentionally do not broadcast transactions, create Safe proposals,
or submit x402 payments. They demonstrate the portable authorization boundary
that provider adapters should verify before execution.

## API Keys

Pass `apiKey` to send a bearer token with each request:

```ts
const finGuard = new FinGuardClient({
  baseUrl: "https://your-finguard-api.com",
  apiKey: process.env.FINGUARD_API_KEY
});
```

When no API key is provided, the SDK omits the `Authorization` header. This is
useful for local development, custom `fetch` implementations, same-origin
cookie auth, or proxy-based authentication. Your API should still enforce auth
for protected endpoints.

## Transaction Checks

Use `checkTransaction` before submitting a transaction. For agent-facing
financial tools, prefer `createFinGuardGuardedAction` so the wallet executor is
not called on blocked or approval-required decisions:

```ts
const result = await finGuard.checkTransaction({
  organizationId: "org-id",
  agentId: "agent-id",
  action: "transfer",
  chain: "ethereum-sepolia",
  token: "USDC",
  amount: "100",
  recipient: "0x1111111111111111111111111111111111111111"
});

if (!result.decision.allowed || result.decision.requiresApproval) {
  console.log("Stopped:", result.decision.reason, result.approvalRequestId);
}
```

## Guarded Relay Execution

Use `executeGuardedTransfer` when the FinGuard API is the only path that can
prepare or submit the transfer:

```ts
const result = await finGuard.executeGuardedTransfer({
  organizationId: "org-id",
  agentId: "agent-id",
  idempotencyKey: "invoice-123-payment-1",
  action: "transfer",
  chain: "ethereum-sepolia",
  token: "USDC",
  amount: "1",
  recipient: "0x1111111111111111111111111111111111111111",
  relayWalletId: "relay-wallet-id",
  dryRun: true
});

if (result.status === "prepared") {
  console.log(result.unsignedPayload);
}

if (result.status === "submitted" || result.status === "confirmed") {
  console.log(result.execution.txHash);
}

if (result.status === "blocked" || result.status === "approval_required") {
  console.log(result.decision.reason, result.approvalRequestId);
}
```

Use a unique `idempotencyKey` for each logical transaction attempt, such as an
invoice payment ID. Retrying the same key returns the existing execution instead
of creating a duplicate transfer.


## Account Abstraction Session Keys

Use account abstraction mode when an agent should act through a constrained
smart account session key. Start with dry-run mode on Ethereum Sepolia; the
backend will return a ZeroDev-style user-operation draft without broadcasting.

```ts
const result = await finGuard.executeAccountAbstraction({
  organizationId: "org-id",
  agentId: "agent-id",
  idempotencyKey: "invoice-123-aa-1",
  smartAccountId: "smart-account-id",
  sessionKeyId: "session-key-id",
  action: "transfer",
  chain: "ethereum-sepolia",
  token: "USDC",
  amount: "1",
  recipient: "0x1111111111111111111111111111111111111111",
  dryRun: true
});

if (result.status === "prepared") {
  console.log(result.userOperationDraft);
}

if (result.status === "submitted") {
  console.log(result.userOperationHash);
}

if (result.status === "blocked" || result.status === "approval_required") {
  console.log(result.decision.reason, result.approvalRequestId);
}
```

The SDK also exposes setup and inspection helpers:

```ts
await finGuard.createSmartAccount({
  organizationId: "org-id",
  name: "ZeroDev Sepolia Account",
  provider: "zerodev",
  chain: "ethereum-sepolia",
  chainId: 11155111,
  address: "0x2222222222222222222222222222222222222222"
});

await finGuard.issueSmartAccountSessionKey({
  organizationId: "org-id",
  smartAccountId: "smart-account-id",
  agentId: "agent-id",
  publicKey: "0x3333333333333333333333333333333333333333",
  expiresAt: "2026-08-01T00:00:00.000Z"
});

const { sessionKeys } = await finGuard.listSmartAccountSessionKeys("org-id", {
  smartAccountId: "smart-account-id",
  status: "active"
});

await finGuard.revokeSmartAccountSessionKey(sessionKeys[0].id, {
  organizationId: "org-id",
  reason: "Rotated key"
});
```

Do not expose a separate signing, private-key, or unrestricted wallet tool to the
same agent. The agent-facing tool should call FinGuard first and should only use
a session key whose permissions match the policy.

## Safe Proposal Flow

Use Safe proposal mode when the agent should never receive a wallet key and
FinGuard should create a Safe transaction proposal only after policy approval.
Owners still review, sign, and execute in Safe.

```ts
const result = await finGuard.createSafeProposal({
  organizationId: "org-id",
  agentId: "agent-id",
  idempotencyKey: "invoice-123-safe-proposal-1",
  action: "transfer",
  chain: "ethereum-sepolia",
  token: "USDC",
  amount: "1",
  recipient: "0x1111111111111111111111111111111111111111",
  safeWalletId: "safe-wallet-id"
});

if (result.status === "proposed") {
  console.log(result.safeProposal.safeTxHash);
}

if (result.status === "blocked" || result.status === "approval_required") {
  console.log(result.decision.reason, result.approvalRequestId);
}
```

You can inspect Safe configuration and proposal lifecycle from the SDK:

```ts
const { safeWallets } = await finGuard.listSafeWallets("org-id");
const { safeProposals } = await finGuard.listSafeProposals("org-id", {
  status: "proposed"
});

await finGuard.syncSafeProposals({
  organizationId: "org-id",
  status: "proposed",
  limit: 20
});
```

Use a unique `idempotencyKey` for each logical Safe proposal attempt. Retrying
the same key returns the existing proposal instead of creating a duplicate Safe
transaction.

Full OpenAI Agent, LangChain, CrewAI, and Safe testnet examples will live in a
separate public examples repository when that repo is created.

## Approval Flow

List, approve, and reject approval requests:

```ts
const { approvals } = await finGuard.listApprovals("org-id");

await finGuard.approveRequest(approvals[0].id, {
  reason: "Approved by treasury reviewer"
});

await finGuard.rejectRequest("approval-id", {
  reason: "Recipient is not approved"
});
```

## Agents And Policies

The SDK includes helpers for managing agents and policies:

```ts
const { agent } = await finGuard.createAgent({
  organizationId: "org-id",
  name: "Treasury Agent",
  status: "active"
});

await finGuard.createPolicy({
  organizationId: "org-id",
  agentId: agent.id,
  name: "USDC transfer policy",
  status: "active",
  rulesJson: {
    maxTransactionAmount: "1000",
    dailyLimit: "5000",
    allowedTokens: ["USDC"],
    allowedChains: ["ethereum-sepolia"],
    allowedRecipients: ["0x1111111111111111111111111111111111111111"],
    requiresApprovalAbove: "500"
  }
});
```

## Error Handling

Non-2xx API responses throw `FinGuardApiError`.

```ts
import { FinGuardApiError } from "@finguard/sdk";

try {
  await finGuard.checkTransaction(input);
} catch (error) {
  if (error instanceof FinGuardApiError) {
    console.error(error.status, error.message, error.body);
  }

  throw error;
}
```

The error includes the HTTP `status`, parsed `body` when available, and
structured `details` when the API returns them.

## TypeScript

This package is written in TypeScript and publishes declaration files. Public
types are exported from the package root:

```ts
import type {
  Agent,
  CreateSafeProposalResponse,
  CreatePolicyInput,
  GuardedFinancialActionResult,
  GuardedRelayExecutionResponse,
  SafeProposal,
  SafeWallet,
  TransactionCheckResponse
} from "@finguard/sdk";
```

## Runtime Support

The SDK targets Node.js 18 and newer. It uses the standard `fetch` API and also
supports custom fetch implementations:

```ts
const finGuard = new FinGuardClient({
  baseUrl: "https://your-finguard-api.com",
  fetch: customFetch
});
```

## Versioning

FinGuard SDK follows semantic versioning:

```txt
0.1.x: early SDK fixes
0.x minor: backward-compatible additions while API is still pre-1.0
1.0.0: first stable public SDK
```

After `1.0.0`, patch versions are bug fixes, minor versions are
backward-compatible additions, and major versions contain breaking changes.

## API Compatibility

This SDK currently targets:

```txt
FinGuard API v0
```

## Examples

Public examples will live in the FinGuard examples repository. Until that
repository is published, use the snippets above as the supported reference.
