"use client";
import React, { Suspense } from "react";
import ResetPass from "@/components/auth/resetPass";

const Page = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f3ee] px-6 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-[#ecdccf] bg-white/90 px-10 py-8 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#f97316] to-[#fb7185]" />
          <div>
            <div className="text-2xl font-extrabold text-[#1f1b16]">
              BillSutra
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b45309]">
              Secure reset
            </div>
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[#1f1b16]">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-[#5c4b3b]">
          Choose a strong password to keep your billing data protected.
        </p>

        <div className="mt-6">
          <Suspense fallback={<div>Loading...</div>}>
            <ResetPass />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default Page;
