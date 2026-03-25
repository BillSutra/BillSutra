"use client";

import Link from "next/link";
import Login from "@/components/auth/login";
import LanguageToggle from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";

const WorkerLoginPageContent = () => {
  return (
    <div className="min-h-screen bg-[#f7f2ea] text-[#1f1b16]">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col overflow-hidden px-6 py-10 lg:flex-row lg:items-stretch">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.25),rgba(15,118,110,0))]" />
          <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.22),rgba(249,115,22,0))]" />
          <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),rgba(59,130,246,0))]" />
        </div>

        <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col justify-center gap-6 rounded-3xl border border-[#d8e7e1] bg-white/70 p-8 shadow-[0_30px_90px_-60px_rgba(31,27,22,0.8)] backdrop-blur lg:mr-10 lg:max-w-md">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#0f766e] to-[#2563eb]" />
            <div>
              <div className="text-2xl font-extrabold tracking-tight text-[#1f1b16]">
                BillSutra
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5f7c75]">
                Worker access
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-semibold leading-tight">
            Sign in as a worker for your business workspace.
          </h1>
          <p className="text-sm text-[#4f5f5a]">
            Use the worker account created by your business admin to access the
            shared dashboard and daily operations.
          </p>
          <div className="grid gap-3 text-sm text-[#4f5f5a]">
            <div className="flex items-center justify-between rounded-2xl border border-[#dfeae5] bg-white/80 px-4 py-3">
              <span>Shared business data</span>
              <span className="font-semibold text-[#1f1b16]">Live</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-[#dfeae5] bg-white/80 px-4 py-3">
              <span>Role-aware access</span>
              <span className="font-semibold text-[#1f1b16]">Secure</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-1 items-center lg:mt-0">
          <div className="w-full rounded-3xl border border-[#d8e7e1] bg-white/90 px-8 py-10 shadow-xl">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5f7c75]">
                Worker login
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Welcome back</h2>
              <p className="mt-2 text-sm text-[#4f5f5a]">
                Sign in with the worker email and password assigned to you.
              </p>
            </div>
            <Login mode="worker" />
            <p className="mt-6 text-center text-sm text-[#4f5f5a]">
              Business owner?{" "}
              <Link href="/login" className="font-semibold text-[#b45309]">
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
