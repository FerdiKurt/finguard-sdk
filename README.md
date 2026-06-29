# @finguard/sdk

TypeScript SDK for FinGuard policy checks and approval workflows.

FinGuard helps applications evaluate transaction intent against organization and
agent policies before execution. The SDK provides a typed client for creating
agents and policies, checking transactions, and handling approval requests.

## Installation

```bash
pnpm add @finguard/sdk
```

## Safety Model

The SDK is a policy client, not a wallet, custodian, signer, or transaction
broadcaster. It tells your application whether a proposed financial action is
allowed, blocked, or waiting for human approval.

Every financial tool exposed to an AI agent must call FinGuard before touching a
wallet or execution service. Do not expose a raw wallet, token transfer,
custodian, or blockchain broadcast tool beside the guarded tool. If an agent has
both a guarded tool and an unguarded wallet tool, it can bypass FinGuard.

The correct boundary is:

1. Agent proposes a financial action.
2. Your tool calls FinGuard with the exact action details.
3. Your tool stops when FinGuard blocks or requires approval.
4. Your tool executes only when `allowed === true` and `requiresApproval === false`.

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
