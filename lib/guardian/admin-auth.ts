export function verifyGuardianAdminKey(request: Request) {
  const expectedKey = process.env.GUARDIAN_WEB_ADMIN_KEY?.trim();

  if (!expectedKey) {
    return {
      ok: false,
      message: "Web execution is disabled. Set GUARDIAN_WEB_ADMIN_KEY to enable guarded web submissions."
    };
  }

  const providedKey = request.headers.get("x-guardian-admin-key")?.trim();

  if (providedKey !== expectedKey) {
    return {
      ok: false,
      message: "Guardian admin key is missing or invalid."
    };
  }

  return {
    ok: true,
    message: "Guardian admin key verified."
  };
}
