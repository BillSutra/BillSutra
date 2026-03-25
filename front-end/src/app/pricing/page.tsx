import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth";
import Pricing from "@/components/pricing";
import { Button } from "@/components/ui/button";
import { authOptions, type CustomSession } from "../api/auth/[...nextauth]/options";

export default async function PricingPage() {
  const session: CustomSession | null = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-[#1f1b16]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-[#e7d8c3] bg-white/85 px-6 py-5 shadow-[0_24px_80px_-56px_rgba(31,27,22,0.35)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8a6b45]">
              Billsutra pricing
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Pick an INR plan that feels safe today and valuable tomorrow
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6a635b]">
              Designed for retailers, freelancers, and growing small businesses
              that want predictable billing software without enterprise friction
              or enterprise pricing.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={isAuthenticated ? "/dashboard" : "/"}>
                <ArrowLeft size={16} />
                {isAuthenticated ? "Back to dashboard" : "Back to home"}
              </Link>
            </Button>
            {!isAuthenticated ? (
              <Button asChild>
                <Link href="/register">
                  Start Free
                  <ArrowRight size={16} />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Pricing isAuthenticated={isAuthenticated} />
    </main>
  );
}
