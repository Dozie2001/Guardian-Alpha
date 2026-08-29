import { afterEach, describe, expect, it } from "vitest";
import { getGuardianRuntimeConfig } from "@/lib/guardian/runtime-config";

const originalEnv = { ...process.env };

describe("getGuardianRuntimeConfig", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("defaults to demo paper mode", () => {
    delete process.env.GUARDIAN_DEPLOYMENT_MODE;

    expect(getGuardianRuntimeConfig()).toMatchObject({
      deploymentMode: "demo",
      tradingEnvironment: "paper",
      accountModel: "server_demo_account"
    });
  });

  it("supports commercial paper account framing", () => {
    process.env.GUARDIAN_DEPLOYMENT_MODE = "commercial";

    expect(getGuardianRuntimeConfig()).toMatchObject({
      deploymentMode: "commercial",
      tradingEnvironment: "paper",
      accountModel: "bring_your_own_account"
    });
  });
});
