"use client";
import React from "react";
import ForgetPass from "../../../components/auth/forgetPass";

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
              Reset access
            </div>
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[#1f1b16]">
          Forgot your password?
        </h1>
        <p className="mt-2 text-sm text-[#5c4b3b]">
          Enter your email and we will send a reset link.
        </p>

        <div className="mt-6">
          <ForgetPass />
        </div>
      </div>
    </div>
  );
};

export default Page;
