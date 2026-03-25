"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileSearch,
  Home,
  LayoutDashboard,
  ReceiptText,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const quickLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Return to your Billsutra workspace.",
    icon: LayoutDashboard,
  },
  {
    href: "/invoices",
    label: "Invoices",
    description: "Create, review, and send invoices.",
    icon: ReceiptText,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Update your account and billing setup.",
    icon: Settings,
  },
];

export default function NotFoundPage() {
  const router = useRouter();

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_55%,#ffffff_100%)] px-4 py-10 text-slate-950 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] dark:text-slate-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,#bfdbfe_0,transparent_55%)] opacity-70 dark:bg-[radial-gradient(circle_at_top,#1d4ed8_0,transparent_55%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full gap-8 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_30px_100px_-48px_rgba(15,23,42,0.4)] backdrop-blur xl:grid-cols-[minmax(0,1.05fr)_360px] xl:p-10 dark:border-slate-800/80 dark:bg-slate-950/80">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
              <FileSearch className="h-4 w-4" />
              Page unavailable
            </div>

            <div className="mt-6 max-w-2xl">
              <p className="font-[var(--font-geist-mono)] text-sm uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                404 error
              </p>
              <h1 className="mt-3 font-[var(--font-fraunces)] text-4xl leading-tight sm:text-5xl">
                404 - Page Not Found
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                The page you&apos;re looking for doesn&apos;t exist or has been
                moved. Billsutra is still here, and the quickest path back is
                just below.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-xl px-6">
                <Link href="/">
                  <Home className="h-4 w-4" />
                  Go to homepage
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-xl px-6"
                onClick={handleGoBack}
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </Button>
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/90 p-6 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    Lost in Billsutra?
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    Start from a trusted page
                  </h2>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-950">
                  <FileSearch className="h-7 w-7 text-sky-600 dark:text-sky-300" />
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {quickLinks.map(({ href, label, description, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group rounded-2xl border border-slate-200 bg-white px-4 py-4 transition-colors hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-900 dark:hover:bg-sky-950/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-sky-100 group-hover:text-sky-700 dark:bg-slate-900 dark:text-slate-200 dark:group-hover:bg-sky-950 dark:group-hover:text-sky-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold">{label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                          {description}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
