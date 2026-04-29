"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ValidationField } from "@/components/ui/ValidationField";
import { loginSuperAdmin } from "@/lib/adminApiClient";
import { useAdminAuth } from "@/providers/AdminAuthProvider";
import { validateEmail } from "@/lib/validation";

const AdminLoginClient = () => {
  const router = useRouter();
  const { handleLoginSuccess, status } = useAdminAuth();
  const [email, setEmail] = useState("admin@billsutra.com");
  const [password, setPassword] = useState("qwerty123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await loginSuperAdmin({ email, password });
      handleLoginSuccess(session.user);
      router.replace("/admin/dashboard");
    } catch (requestError) {
      if (isAxiosError<{ message?: string }>(requestError)) {
        setError(
          requestError.response?.data?.message || "Unable to sign in as super admin.",
        );
      } else {
        setError("Unable to sign in as super admin.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f4c98d_0%,#f3e4d0_35%,#f7f2ea_100%)] px-4 py-12 text-[#1f1b16]">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[#e7d6c4] bg-white shadow-[0_30px_90px_rgba(63,38,18,0.12)] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col justify-between bg-[#1f1b16] px-8 py-10 text-white sm:px-10">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.35em] text-[#f4c98d]">
              Bill Sutra
            </p>
            <div className="space-y-4">
              <h1 className="font-[var(--font-fraunces)] text-4xl leading-tight sm:text-5xl">
                Super Admin Panel
              </h1>
              <p className="max-w-md text-sm leading-6 text-white/72">
                Access the platform-wide control room for tenant oversight, worker
                visibility, and secure business management.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-sm font-semibold text-[#f4c98d]">Capabilities</p>
            <div className="mt-4 grid gap-3 text-sm text-white/80">
              <p>View every business and worker across the platform.</p>
              <p>Inspect business-level details before taking action.</p>
              <p>Delete tenant accounts from a secure isolated control panel.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10 sm:px-10">
          <form
            className="w-full max-w-md space-y-5 rounded-[1.75rem] border border-[#efe2d3] bg-[#fffaf4] p-8 shadow-sm"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-[#8a6d56]">
                Restricted Access
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                Admin Sign In
              </h2>
              <p className="text-sm text-[#6f5846]">
                Only seeded super-admin credentials can access this area.
              </p>
            </div>

            <ValidationField
              id="admin-email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              validate={(value) => validateEmail(value)}
              required
              placeholder="admin@billsutra.com"
              success
            />

            <ValidationField
              id="admin-password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              validate={(value) =>
                value.trim().length >= 6 ? "" : "Password must be at least 6 characters"
              }
              required
              placeholder="Enter super admin password"
              success
            />

            {error ? <p className="text-sm text-[#b45309]">{error}</p> : null}

            <Button
              type="submit"
              className="h-11 w-full bg-[#1f1b16] text-white hover:bg-[#2d241d]"
              disabled={isSubmitting || status === "loading"}
            >
              {isSubmitting ? "Signing in..." : "Enter Admin Panel"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginClient;
