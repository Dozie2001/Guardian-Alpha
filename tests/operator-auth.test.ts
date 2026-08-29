import { afterEach, describe, expect, it } from "vitest";
import { authorizeGuardianOperator } from "@/lib/guardian/operator-auth";

const originalEnv = { ...process.env };

describe("authorizeGuardianOperator", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects invalid credential shapes", () => {
    process.env.GUARDIAN_AUTH_EMAIL = "operator@example.com";
    process.env.GUARDIAN_AUTH_PASSWORD = "strong-password";

    expect(authorizeGuardianOperator({ email: "not-email", password: "strong-password" })).toBeNull();
    expect(authorizeGuardianOperator({ email: "operator@example.com" })).toBeNull();
  });

  it("rejects when operator credentials are not configured", () => {
    delete process.env.GUARDIAN_AUTH_EMAIL;
    delete process.env.GUARDIAN_AUTH_PASSWORD;

    expect(authorizeGuardianOperator({ email: "operator@example.com", password: "strong-password" })).toBeNull();
  });

  it("rejects incorrect credentials", () => {
    process.env.GUARDIAN_AUTH_EMAIL = "operator@example.com";
    process.env.GUARDIAN_AUTH_PASSWORD = "strong-password";

    expect(authorizeGuardianOperator({ email: "operator@example.com", password: "wrong-password" })).toBeNull();
    expect(authorizeGuardianOperator({ email: "other@example.com", password: "strong-password" })).toBeNull();
  });

  it("accepts the configured operator credentials", () => {
    process.env.GUARDIAN_AUTH_EMAIL = "operator@example.com";
    process.env.GUARDIAN_AUTH_PASSWORD = "strong-password";

    expect(authorizeGuardianOperator({ email: "OPERATOR@example.com", password: "strong-password" })).toMatchObject({
      id: "guardian-operator",
      email: "operator@example.com"
    });
  });
});
