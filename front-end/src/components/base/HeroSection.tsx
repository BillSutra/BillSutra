import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 via-white to-white">
      <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-red-100 blur-3xl" />
      <div className="absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-orange-100 blur-3xl" />
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 md:grid-cols-2">
        <div className="text-left">
          <div className="mb-4 inline-flex items-center rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
            Built for GST billing and inventory
          </div>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 md:text-5xl">
            GST Billing Software for Small Businesses in India
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Manage billing, inventory, and accounting from one clean dashboard.
            Join thousands of SMEs using BillSutra to stay compliant and get
            paid faster.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" className="bg-red-500 hover:bg-red-600">
                Download BillSutra Now
              </Button>
            </Link>
            <Link
              href="#features"
              className="text-sm font-semibold text-gray-700"
            >
              View features
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-gray-500">
            <span>1 Cr+ invoices processed</span>
            <span>GST ready reports</span>
            <span>Mobile + Desktop</span>
          </div>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-red-50 to-orange-50" />
          <img
            src="/images/conversation.svg"
            alt="Billing dashboard preview"
            className="relative w-full max-w-md"
          />
        </div>
      </div>
    </section>
  );
}
