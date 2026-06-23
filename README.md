# @finguard/sdk

TypeScript SDK for FinGuard policy checks and approval workflows.

FinGuard helps applications evaluate transaction intent against organization and
agent policies before execution. The SDK provides a typed client for creating
agents and policies, checking transactions, and handling approval requests.

## Installation

```bash
pnpm add @finguard/sdk
```

## Basic Usage

```ts
import { FinGuardClient } from "@finguard/sdk";

const finGuard = new FinGuardClient({
  baseUrl: "https://your-finguard-api.com",
  apiKey: process.env.FINGUARD_API_KEY
});

const result = await finGuard.checkTransaction({
  organizationId: "org-id",
  agentId: "agent-id",
  action: "transfer",
  chain: "ethereum-sepolia",
  token: "USDC",
  amount: "1",
  recipient: "0x1111111111111111111111111111111111111111"
});

if (result.decision.allowed && !result.decision.requiresApproval) {
  // Execute the transaction.
}
```

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

Use `checkTransaction` before submitting a transaction:

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

if (result.decision.requiresApproval && result.approvalRequestId) {
  console.log("Approval required:", result.approvalRequestId);
}
```

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
  CreatePolicyInput,
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

## Examples

Public examples will live in the FinGuard examples repository. Until that
repository is published, use the snippets above as the supported reference.
