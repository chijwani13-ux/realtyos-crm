import CrmApp from "@/components/CrmApp";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  return (
    <CrmApp
      currentUser={{
        name: session?.user?.name ?? null,
        email: session?.user?.email ?? "",
        role: session?.user?.role ?? "Owner",
      }}
    />
  );
}
