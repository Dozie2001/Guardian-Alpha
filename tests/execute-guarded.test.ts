import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultPolicy } from "@/lib/policy/types";
import { executeGuardedTrade } from "@/lib/trade/execute-guarded";
import { demoPortfolio, demoTradeIntents } from "@/lib/trade/mock-data";

const originalEnv = { ...process.env };

describe("executeGuardedTrade", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_SECRET_KEY;
    delete process.env.APCA_API_KEY_ID;
    delete process.env.APCA_API_SECRET_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not submit review-sized trades until human approval is present", async () => {
    const intent = {
      ...demoTradeIntents[0],
      notionalUsd: 3_000,
      clientOrderId: "guardian-test-human-review"
    };

    const previewReceipt = await executeGuardedTrade({
      intent,
      policy: defaultPolicy,
      portfolio: demoPortfolio
    });

    expect(previewReceipt.status).toBe("approved");
    expect(previewReceipt.reasons).toContain("Human approval is required before execution.");

    const submittedReceipt = await executeGuardedTrade({
      intent: {
        ...intent,
        clientOrderId: "guardian-test-human-review-ok"
      },
      policy: defaultPolicy,
      portfolio: demoPortfolio,
      humanApproved: true
    });

    expect(submittedReceipt.status).toBe("submitted");
    expect(submittedReceipt.alpacaOrderId).toBe("mock-guardian-test-human-review-ok");
  });
});
