import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PasskeySettingsCard from "@/components/profile/PasskeySettingsCard";
import PlanManagementCard from "@/components/pricing/PlanManagementCard";

const SettingsPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name?.trim() ?? "";

  return (
    <DashboardLayout
      name={name}
      image={session?.user?.image || undefined}
      title="Settings"
      subtitle="Manage account and invoice configuration preferences."
    >
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="app-panel rounded-3xl p-6">
          <p className="app-kicker">Security</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">
            Account access
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Save a passkey for this account so you can sign in with your
            device biometrics or PIN. Each passkey is attached only to the
            currently signed-in account.
          </p>
        </section>

        <PasskeySettingsCard />

        <PlanManagementCard
          title="Pricing where account decisions happen"
          description="Review Free, Pro, and Pro Plus from Settings so subscription decisions sit next to your security, branding, and invoice preferences."
          compact
        />

        <section className="app-panel rounded-3xl p-6">
          <p className="app-kicker">Preferences</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">
            Invoice preferences
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage invoice defaults and branding preferences from the business
            profile and templates pages.
          </p>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
