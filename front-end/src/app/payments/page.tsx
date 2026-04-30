import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PaymentsWorkspaceClient from "@/components/payments/PaymentsWorkspaceClient";
import { authOptions, type CustomSession } from "../api/auth/[...nextauth]/options";

type PaymentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentsPage({
  searchParams,
}: PaymentsPageProps) {
  const session: CustomSession | null = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const hasLegacyBillingParams = Boolean(
    resolvedSearchParams?.plan ||
      resolvedSearchParams?.billing_cycle ||
      resolvedSearchParams?.billingCycle,
  );

  if (hasLegacyBillingParams) {
    const query = new URLSearchParams();

    Object.entries(resolvedSearchParams ?? {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry) query.append(key, entry);
        });
        return;
      }

      if (value) {
        query.set(key, value);
      }
    });

    redirect(`/payments/access${query.size ? `?${query.toString()}` : ""}`);
  }

  return (
    <DashboardLayout
      name={session.user.name ?? "User"}
      image={session.user.image ?? undefined}
      title="Payments"
      subtitle="Track collections, follow up on dues, and keep proof files attached to real customer payments."
    >
      <PaymentsWorkspaceClient />
    </DashboardLayout>
  );
}
