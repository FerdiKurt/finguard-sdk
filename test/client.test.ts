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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Missing API key." } }), {
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
      message: "Missing API key."
    });

    expect(FinGuardApiError).toBeDefined();
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
