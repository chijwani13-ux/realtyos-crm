import { auth } from "@/lib/auth";

export async function requireOwner() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401 as const, error: "Not authenticated" };
  }
  if (session.user.role === "Employee") {
    return { ok: false as const, status: 403 as const, error: "Owner access required" };
  }
  return { ok: true as const, session };
}
