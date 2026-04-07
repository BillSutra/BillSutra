import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PaymentAccessClient from "@/components/payments/PaymentAccessClient";
import { authOptions, type CustomSession } from "../api/auth/[...nextauth]/options";

export default async function PaymentsPage() {
  const session: CustomSession | null = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardLayout
      name={session.user.name ?? "User"}
      image={session.user.image ?? undefined}
      title="Payments"
      subtitle="Choose a plan, pay with Razorpay or UPI, and track when access becomes active."
    >
      <PaymentAccessClient
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
      />
    </DashboardLayout>
  );
}
