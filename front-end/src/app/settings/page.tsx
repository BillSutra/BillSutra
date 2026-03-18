import { getServerSession } from "next-auth";
import { authOptions, CustomSession } from "../api/auth/[...nextauth]/options";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const SettingsPage = async () => {
  const session: CustomSession | null = await getServerSession(authOptions);
  const name = session?.user?.name || "Guest";

  return (
    <DashboardLayout
      name={name}
      image={session?.user?.image || undefined}
      title="Settings"
      subtitle="Manage account and invoice configuration preferences."
    >
      <div className="mx-auto w-full max-w-4xl">
        <section className="app-panel rounded-3xl p-6">
          <p className="app-kicker">Preferences</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">Invoice preferences</h2>
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
