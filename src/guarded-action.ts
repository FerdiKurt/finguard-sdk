import type { FinGuardClient } from "./client";
import type { PolicyDecision, TransactionCheckInput } from "./types";

export type FinancialActionExecutor<TReceipt> = (
  input: TransactionCheckInput,
) => Promise<TReceipt>;

export type GuardedFinancialActionResult<TReceipt> =
  | {
      status: "executed";
      decision: PolicyDecision;
      transactionCheckId: string;
      approvalRequestId: null;
      receipt: TReceipt;
    }
  | {
      status: "blocked";
      decision: PolicyDecision;
      transactionCheckId: string;
      approvalRequestId: string | null;
    };

export function createFinGuardGuardedAction<TReceipt>(
  client: Pick<FinGuardClient, "checkTransaction">,
  executeFinancialAction: FinancialActionExecutor<TReceipt>,
) {
  return async function guardedFinancialAction(
    input: TransactionCheckInput,
  ): Promise<GuardedFinancialActionResult<TReceipt>> {
    const check = await client.checkTransaction(input);

    if (!check.decision.allowed || check.decision.requiresApproval) {
      return {
        status: "blocked",
        decision: check.decision,
        transactionCheckId: check.transactionCheckId,
        approvalRequestId: check.approvalRequestId,
      };
    }

    const receipt = await executeFinancialAction(input);

    return {
      status: "executed",
      decision: check.decision,
      transactionCheckId: check.transactionCheckId,
      approvalRequestId: null,
      receipt,
    };
  };
}
