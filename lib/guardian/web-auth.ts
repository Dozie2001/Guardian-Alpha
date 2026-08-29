import { auth } from "@/auth";
import { verifyGuardianAdminKey } from "@/lib/guardian/admin-auth";

export async function verifyGuardianWebAccess(request: Request) {
  const session = await auth();
  if (session?.user) {
    return {
      ok: true,
      message: "Guardian operator session verified."
    };
  }

  return verifyGuardianAdminKey(request);
}
