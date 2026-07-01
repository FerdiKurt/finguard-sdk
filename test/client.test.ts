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


  it("manages smart accounts", async () => {
    const smartAccount = {
      id: "smart_account_123",
      organizationId: "org_123",
      name: "ZeroDev Sepolia Account",
      provider: "zerodev",
      chain: "ethereum-sepolia",
      chainId: 11155111,
      address: "0x2222222222222222222222222222222222222222",
      status: "active",
      metadataJson: {},
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      disabledAt: null,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ smartAccount }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ smartAccounts: [smartAccount] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock,
    });
    const input = {
      organizationId: "org_123",
      name: smartAccount.name,
      provider: "zerodev" as const,
      chain: "ethereum-sepolia" as const,
      chainId: 11155111 as const,
      address: smartAccount.address,
    };

    await expect(client.createSmartAccount(input)).resolves.toEqual({ smartAccount });
    await expect(client.listSmartAccounts("org_123", "active")).resolves.toEqual({
      smartAccounts: [smartAccount],
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.finguard.dev/api/smart-accounts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.finguard.dev/api/smart-accounts?organizationId=org_123&status=active",
      expect.any(Object)
    );
  });

  it("manages smart account session keys", async () => {
    const sessionKey = {
      id: "session_key_123",
      organizationId: "org_123",
      smartAccountId: "smart_account_123",
      agentId: "agent_123",
      policyId: "policy_123",
      policyVersionId: "policy_version_123",
      publicKey: "0x3333333333333333333333333333333333333333",
      keyReference: "env://ZERODEV_AGENT_SESSION_PUBLIC_KEY",
      status: "active",
      permissionsJson: { provider: "zerodev" },
      metadataJson: {},
      issuedAt: "2026-07-01T00:00:00.000Z",
      expiresAt: "2026-08-01T00:00:00.000Z",
      lastUsedAt: null,
      revokedAt: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessionKey }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessionKeys: [sessionKey] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sessionKey: { ...sessionKey, status: "revoked", revokedAt: "2026-07-01T00:30:00.000Z" },
        revocation: {
          id: "revocation_123",
          organizationId: "org_123",
          smartAccountId: "smart_account_123",
          sessionKeyId: "session_key_123",
          agentId: "agent_123",
          reason: "Rotated key",
          revokedBy: "sdk-test",
          metadataJson: {},
          createdAt: "2026-07-01T00:30:00.000Z",
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    const client = new FinGuardClient({
      baseUrl: "https://api.finguard.dev",
      fetch: fetchMock,
    });
    const issueInput = {
      organizationId: "org_123",
      smartAccountId: "smart_account_123",
      agentId: "agent_123",
      publicKey: sessionKey.publicKey,
      keyReference: sessionKey.keyReference,
      expiresAt: sessionKey.expiresAt,
    };

    await expect(client.issueSmartAccountSessionKey(issueInput)).resolves.toEqual({ sessionKey });
    await expect(client.listSmartAccountSessionKeys("org_123", {
      smartAccountId: "smart_account_123",
      agentId: "agent_123",
      status: "active",
    })).resolves.toEqual({ sessionKeys: [sessionKey] });
    await expect(client.revokeSmartAccountSessionKey("session_key_123", {
      organizationId: "org_123",
      reason: "Rotated key",
      revokedBy: "sdk-test",
    })).resolves.toMatchObject({
      sessionKey: { id: "session_key_123", status: "revoked" },
      revocation: { sessionKeyId: "session_key_123" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.finguard.dev/api/smart-account-session-keys",
      expect.objectContaining({ method: "POST", body: JSON.stringify(issueInput) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.finguard.dev/api/smart-account-session-keys?organizationId=org_123&smartAccountId=smart_account_123&agentId=agent_123&status=active",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.finguard.dev/api/smart-account-session-keys/session_key_123/revoke",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          organizationId: "org_123",
          reason: "Rotated key",
          revokedBy: "sdk-test",
        }),
      })
    );
  });

  it("executes account abstraction transfers in dry-run mode", async () => {
    const responseBody = {
      status: "prepared",
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
        smartAccountId: "smart_account_123",
        smartAccountSessionKeyId: "session_key_123",
        idempotencyKey: "invoice-123-aa-1",
        policyId: "policy_123",
        policyVersionId: "policy_version_123",
        action: "transfer",
        status: "pending",
        chain: "ethereum-sepolia",
        token: "USDC",
        amount: "1",
        recipient: "0x1111111111111111111111111111111111111111",
        txHash: null,
        blockNumber: null,
        failureReason: null,
      },
      userOperationDraft: {
        provider: "zerodev",
        chain: "ethereum-sepolia",
        chainId: 11155111,
        sender: "0x2222222222222222222222222222222222222222",
        sessionKeyId: "session_key_123",
        sessionPublicKey: "0x3333333333333333333333333333333333333333",
        target: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        value: "0",
        data: "0x1234",
        permission: {
          action: "erc20.transfer",
          token: "USDC",
          recipient: "0x1111111111111111111111111111111111111111",
          amount: "1",
        },
      },
      dryRun: true,
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
      idempotencyKey: "invoice-123-aa-1",
      smartAccountId: "smart_account_123",
      sessionKeyId: "session_key_123",
      action: "transfer",
      chain: "ethereum-sepolia",
      token: "USDC",
      amount: "1",
      recipient: "0x1111111111111111111111111111111111111111",
      dryRun: true,
    };

    await expect(client.executeAccountAbstraction(input)).resolves.toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finguard.dev/api/executions/account-abstraction",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      })
    );
  });

  it("lists Safe wallets", async () => {
    const responseBody = { safeWallets: [] };
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

    await expect(client.listSafeWallets("org_123")).resolves.toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finguard.dev/api/safe-wallets?organizationId=org_123",
      expect.any(Object)
    );
  });

  it("creates Safe proposals through proposal-only flow", async () => {
    const responseBody = {
      status: "proposed",
      decision: {
        allowed: true,
        requiresApproval: false,
        reason: "Allowed",
        matchedRules: [],
      },
      transactionCheckId: "check_123",
      approvalRequestId: null,
      safeProposal: { id: "safe_proposal_123" },
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
      idempotencyKey: "invoice-123-safe-proposal-1",
      action: "transfer",
      chain: "ethereum-sepolia",
      token: "USDC",
      amount: "1",
      recipient: "0x1111111111111111111111111111111111111111",
      safeWalletId: "safe_wallet_123",
    };

    await expect(client.createSafeProposal(input)).resolves.toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finguard.dev/api/safe-proposals",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      })
    );
  });

  it("lists Safe proposals with filters", async () => {
    const responseBody = { safeProposals: [] };
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

    await expect(
      client.listSafeProposals("org_123", {
        status: "proposed",
        safeWalletId: "safe_wallet_123",
        agentId: "agent_123",
      })
    ).resolves.toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finguard.dev/api/safe-proposals/list?organizationId=org_123&status=proposed&safeWalletId=safe_wallet_123&agentId=agent_123",
      expect.any(Object)
    );
  });

  it("syncs Safe proposals", async () => {
    const responseBody = { synced: [], skipped: [] };
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
      status: "proposed" as const,
      limit: 20,
    };

    await expect(client.syncSafeProposals(input)).resolves.toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finguard.dev/api/safe-proposals/sync",
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
