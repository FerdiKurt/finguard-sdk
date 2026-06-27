import { describe, expect, it, vi } from "vitest";

import { FinGuardApiError, FinGuardClient } from "../src";

describe("FinGuardClient", () => {
  it("sends API key header when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agents: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      apiKey: "test-key",
      fetch: fetchMock
    });

    await client.listAgents("org_123");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finguard.dev/api/agents?organizationId=org_123",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key"
        })
      })
    );
  });

  it("sends requests without an API key when none is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agents: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock
    });

    await client.listAgents("org_123");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finguard.dev/api/agents?organizationId=org_123",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String)
        })
      })
    );
  });

  it("encodes query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agents: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock
    });

    await client.listAgents("org 123/abc");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finguard.dev/api/agents?organizationId=org+123%2Fabc",
      expect.any(Object)
    );
  });

  it("sends JSON request bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agent: { id: "agent_123" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock
    });

    await client.createAgent({
      organizationId: "org_123",
      name: "Treasury Agent",
      description: null,
      status: "active"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finguard.dev/api/agents",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          organizationId: "org_123",
          name: "Treasury Agent",
          description: null,
          status: "active"
        })
      })
    );
  });

  it("throws FinGuardApiError for API errors", async () => {
    const errorBody = {
      error: {
        message: "Missing API key.",
        details: { code: "missing_api_key" }
      }
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorBody), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    );

    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock
    });

    await expect(client.listApprovals("org_123")).rejects.toMatchObject({
      name: "FinGuardApiError",
      status: 401,
      message: "Missing API key.",
      details: { code: "missing_api_key" },
      body: errorBody
    });

    expect(FinGuardApiError).toBeDefined();
  });

  it("throws FinGuardApiError for empty response bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 502
      })
    );

    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock
    });

    await expect(client.listAgents("org_123")).rejects.toMatchObject({
      name: "FinGuardApiError",
      status: 502,
      message: "FinGuard API returned an empty response body."
    });
  });

  it("throws FinGuardApiError for invalid JSON responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock
    });

    await expect(client.listAgents("org_123")).rejects.toMatchObject({
      name: "FinGuardApiError",
      status: 200,
      message: "FinGuard API returned invalid JSON.",
      body: "not-json"
    });
  });

  it("checks a transaction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          decision: {
            allowed: true,
            requiresApproval: false,
            reason: "Allowed",
            matchedRules: []
          },
          transactionCheckId: "check_123"
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );

    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock
    });

    const result = await client.checkTransaction({
      organizationId: "org_123",
      agentId: "agent_123",
      action: "transfer",
      chain: "ethereum-sepolia",
      token: "USDC",
      amount: "1",
      recipient: "0x1111111111111111111111111111111111111111"
    });

    expect(result.decision.allowed).toBe(true);
    expect(result.transactionCheckId).toBe("check_123");
  });

  it("executes guarded relay transfers with idempotency", async () => {
    const responseBody = {
      status: "submitted",
      decision: {
        allowed: true,
        requiresApproval: false,
        reason: "Allowed",
        matchedRules: [],
      },
      transactionCheckId: "check_123",
      approvalRequestId: null,
      execution: {
        id: "execution_123",
        organizationId: "org_123",
        agentId: "agent_123",
        transactionCheckId: "check_123",
        idempotencyKey: "invoice-123-payment-1",
        policyId: "policy_123",
        policyVersionId: "policy_version_123",
        action: "transfer",
        status: "submitted",
        chain: "ethereum-sepolia",
        token: "USDC",
        amount: "1",
        recipient: "0x1111111111111111111111111111111111111111",
        txHash: `0x${"a".repeat(64)}`,
        blockNumber: "11137617",
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock,
    });

    const input = {
      organizationId: "org_123",
      agentId: "agent_123",
      idempotencyKey: "invoice-123-payment-1",
      action: "transfer",
      chain: "ethereum-sepolia",
      token: "USDC",
      amount: "1",
      recipient: "0x1111111111111111111111111111111111111111",
      relayWalletId: "relay_wallet_123",
      dryRun: false,
    };

    await expect(client.executeGuardedTransfer(input)).resolves.toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finguard.dev/api/executions/guarded-transfer",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      })
    );
  });

  it("calls approval action endpoints", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(
        JSON.stringify({
          approvalRequest: { id: "approval_123" },
          transactionCheck: { id: "check_123" }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      ))
    );

    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock
    });

    await client.approveRequest("approval/123", { reason: "Looks good" });
    await client.rejectRequest("approval/123");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.finguard.dev/api/approvals/approval%2F123/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Looks good" })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.finguard.dev/api/approvals/approval%2F123/reject",
      expect.objectContaining({
        method: "POST",
        body: undefined
      })
    );
  });
});
