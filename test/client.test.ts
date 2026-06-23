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
});
