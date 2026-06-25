import { describe, expect, it, vi } from "vitest";

import {
  createFinGuardGuardedAction,
  type FinancialActionExecutor,
  type TransactionCheckInput,
} from "../src";

const transactionInput: TransactionCheckInput = {
  organizationId: "385b8680-d7a3-415a-9fee-7ca0d6dc9351",
  agentId: "62fd4dd2-26d4-4219-87c9-70291b7efae9",
  action: "transfer",
  chain: "ethereum-sepolia",
  token: "USDC",
  amount: "1",
  recipient: "0x1111111111111111111111111111111111111111",
};

describe("createFinGuardGuardedAction", () => {
  it("executes the financial action after an allowed decision", async () => {
    const client = {
      checkTransaction: vi.fn().mockResolvedValue({
        decision: {
          allowed: true,
          requiresApproval: false,
          reason: "Allowed",
          matchedRules: [],
        },
        transactionCheckId: "49df4675-007d-4950-a36f-391379e418e8",
        approvalRequestId: null,
      }),
    };
    const executeFinancialAction: FinancialActionExecutor<{ txHash: string }> = vi
      .fn()
      .mockResolvedValue({ txHash: "0x123" });

    const guardedAction = createFinGuardGuardedAction(
      client,
      executeFinancialAction,
    );

    await expect(guardedAction(transactionInput)).resolves.toEqual({
      status: "executed",
      decision: {
        allowed: true,
        requiresApproval: false,
        reason: "Allowed",
        matchedRules: [],
      },
      transactionCheckId: "49df4675-007d-4950-a36f-391379e418e8",
      approvalRequestId: null,
      receipt: { txHash: "0x123" },
    });
    expect(client.checkTransaction).toHaveBeenCalledWith(transactionInput);
    expect(executeFinancialAction).toHaveBeenCalledWith(transactionInput);
  });

  it("stops without execution after a blocked decision", async () => {
    const client = {
      checkTransaction: vi.fn().mockResolvedValue({
        decision: {
          allowed: false,
          requiresApproval: false,
          reason: "Recipient not allowed",
          matchedRules: ["allowedRecipients"],
        },
        transactionCheckId: "49df4675-007d-4950-a36f-391379e418e8",
        approvalRequestId: null,
      }),
    };
    const executeFinancialAction = vi.fn();
    const guardedAction = createFinGuardGuardedAction(
      client,
      executeFinancialAction,
    );

    await expect(guardedAction(transactionInput)).resolves.toEqual({
      status: "blocked",
      decision: {
        allowed: false,
        requiresApproval: false,
        reason: "Recipient not allowed",
        matchedRules: ["allowedRecipients"],
      },
      transactionCheckId: "49df4675-007d-4950-a36f-391379e418e8",
      approvalRequestId: null,
    });
    expect(executeFinancialAction).not.toHaveBeenCalled();
  });

  it("stops without execution when human approval is required", async () => {
    const client = {
      checkTransaction: vi.fn().mockResolvedValue({
        decision: {
          allowed: false,
          requiresApproval: true,
          reason: "Approval required",
          matchedRules: ["requiresApprovalAbove"],
        },
        transactionCheckId: "49df4675-007d-4950-a36f-391379e418e8",
        approvalRequestId: "4dcd9e98-408e-4e16-a76a-22ff525ed9b3",
      }),
    };
    const executeFinancialAction = vi.fn();
    const guardedAction = createFinGuardGuardedAction(
      client,
      executeFinancialAction,
    );

    await expect(guardedAction(transactionInput)).resolves.toEqual({
      status: "blocked",
      decision: {
        allowed: false,
        requiresApproval: true,
        reason: "Approval required",
        matchedRules: ["requiresApprovalAbove"],
      },
      transactionCheckId: "49df4675-007d-4950-a36f-391379e418e8",
      approvalRequestId: "4dcd9e98-408e-4e16-a76a-22ff525ed9b3",
    });
    expect(executeFinancialAction).not.toHaveBeenCalled();
  });
});
