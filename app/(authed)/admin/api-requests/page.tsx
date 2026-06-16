import { currentUser } from "@clerk/nextjs/server";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function ApiRequestsPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? undefined;
  if (!(await isAdminEmail(email))) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">API Requests</h2>
      <section className="rounded-lg border border-white/10 p-6 text-sm text-white/50">
        Coming soon.
      </section>
    </div>
  );
}
