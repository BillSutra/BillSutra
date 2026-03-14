import React from "react";
import { Button } from "@/components/ui/button";

export default function FeatureSection() {
  const leftBenefits = [
    {
      title: "Lifetime free basic usage",
      description:
        "Create invoices, track stock, and monitor cashflow with a free GST-ready toolkit.",
    },
    {
      title: "Track your business status",
      description:
        "See sales, payments, and inventory changes in a single view with smart reports.",
    },
    {
      title: "Manage cashflow seamlessly",
      description:
        "Record transactions and keep accounts aligned with automated reminders.",
    },
    {
      title: "Send estimates and quotations",
      description:
        "Create professional quotes, convert them to invoices, and share instantly.",
    },
  ];

  const rightBenefits = [
    {
      title: "Multiple payment options",
      description:
        "Support UPI, cards, wallets, and bank transfers for faster collections.",
    },
    {
      title: "Keep data safe with backups",
      description: "Auto-backups protect your data and keep you audit ready.",
    },
    {
      title: "Build a positive brand image",
      description:
        "Send branded invoices and documents that look professional every time.",
    },
    {
      title: "Track inventory accurately",
      description:
        "Set low-stock alerts and monitor product movement without spreadsheets.",
    },
  ];

  return (
    <section id="features" className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Top 8 Benefits of GST Billing Software
          </h2>
          <p className="mt-3 text-gray-600">
            Everything you need to bill faster, stay compliant, and grow your
            business.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-[1fr_360px_1fr]">
          <div className="space-y-6">
            {leftBenefits.map((item) => (
              <div key={item.title} className="rounded-2xl border p-5">
                <div className="mb-2 text-sm font-semibold text-red-500">
                  Benefit
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                <div className="mt-3 text-sm font-semibold text-red-500">
                  Read more
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="rounded-3xl bg-gradient-to-br from-red-50 to-orange-50 p-6">
              <img
                src="/images/conversation.svg"
                alt="BillSutra mobile preview"
                className="w-full"
              />
            </div>
            <Button size="lg" className="bg-red-500 hover:bg-red-600">
              Download BillSutra Now
            </Button>
          </div>
          <div className="space-y-6">
            {rightBenefits.map((item) => (
              <div key={item.title} className="rounded-2xl border p-5">
                <div className="mb-2 text-sm font-semibold text-red-500">
                  Benefit
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                <div className="mt-3 text-sm font-semibold text-red-500">
                  Read more
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
