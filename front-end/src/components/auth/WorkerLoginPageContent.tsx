"use client";

import Link from "next/link";
import BrandLogo from "@/components/branding/BrandLogo";
import Login from "@/components/auth/login";
import LanguageToggle from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";

const WorkerLoginPageContent = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:flex-row lg:items-stretch lg:gap-6 lg:py-10">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(18,61,101,0.22),rgba(18,61,101,0))]" />
          <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(241,175,34,0.22),rgba(241,175,34,0))]" />
          <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(42,105,158,0.18),rgba(42,105,158,0))]" />
          <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(255,255,255,0))]" />
        </div>

        <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 flex-col justify-between gap-8 overflow-hidden rounded-4xl border border-border/80 bg-card/85 p-8 shadow-[0_32px_100px_-60px_rgba(17,37,63,0.42)] backdrop-blur-xl lg:max-w-116">
          <BrandLogo
            variant="icon"
            className="pointer-events-none absolute -right-10 bottom-2 hidden opacity-[0.08] md:inline-flex"
            iconClassName="h-40 w-40 border-none bg-transparent p-0 shadow-none"
          />
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-border/80 bg-card/85 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Worker access
            </span>
            <BrandLogo
              variant="lockup"
              className="w-full max-w-[18rem]"
              priority
            />
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-foreground">
                Sign in as a worker for your business workspace.
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                Use the worker account created by your business admin to access
                the shared dashboard and daily operations with your assigned
                email or phone number.
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-2xl border border-border/75 bg-card/80 px-4 py-3 shadow-[0_18px_45px_-40px_rgba(17,37,63,0.28)]">
              <span>Shared business data</span>
              <span className="font-semibold text-foreground">Live</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/75 bg-card/80 px-4 py-3 shadow-[0_18px_45px_-40px_rgba(17,37,63,0.28)]">
              <span>Role-aware access</span>
              <span className="font-semibold text-foreground">Secure</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-1 items-center lg:mt-0">
          <div className="w-full rounded-4xl border border-border/80 bg-card/90 px-8 py-10 shadow-[0_36px_110px_-70px_rgba(17,37,63,0.4)] backdrop-blur-xl">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Worker login
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in with the worker email or phone number and password
                assigned to you.
              </p>
            </div>
            <Login mode="worker" />
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Business owner?{" "}
              <Link
                href="/login"
                className="font-semibold text-primary transition-colors hover:text-primary/80"
              >
                Back to owner login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerLoginPageContent;
