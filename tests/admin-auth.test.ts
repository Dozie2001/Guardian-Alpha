import { afterEach, describe, expect, it } from "vitest";
import { verifyGuardianAdminKey } from "@/lib/guardian/admin-auth";

const originalEnv = { ...process.env };

function requestWithKey(key?: string) {
  return new Request("https://guardian.local/api/guarded-trade", {
    method: "POST",
    headers: key ? { "x-guardian-admin-key": key } : undefined
  });
}

describe("verifyGuardianAdminKey", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("disables web execution when no admin key is configured", () => {
    delete process.env.GUARDIAN_WEB_ADMIN_KEY;

    expect(verifyGuardianAdminKey(requestWithKey("anything"))).toMatchObject({
      ok: false
    });
  });

  it("rejects a missing or wrong admin key", () => {
    process.env.GUARDIAN_WEB_ADMIN_KEY = "correct-key";

    expect(verifyGuardianAdminKey(requestWithKey())).toMatchObject({ ok: false });
    expect(verifyGuardianAdminKey(requestWithKey("wrong-key"))).toMatchObject({ ok: false });
  });

  it("accepts the configured admin key", () => {
    process.env.GUARDIAN_WEB_ADMIN_KEY = "correct-key";

    expect(verifyGuardianAdminKey(requestWithKey("correct-key"))).toMatchObject({
      ok: true
    });
  });
});
