"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SetupProgressCardProps = {
  language: "en" | "hi" | "hinglish";
  progress: {
    businessReady: boolean;
    productsReady: boolean;
    customersReady: boolean;
    billsReady: boolean;
  };
  onSeedDemo: () => void;
  isSeedingDemo?: boolean;
  demoSeeded?: boolean;
};

const SetupProgressCard = ({
  language,
  progress,
  onSeedDemo,
  isSeedingDemo = false,
  demoSeeded = false,
}: SetupProgressCardProps) => {
  const copy =
    language === "hi"
      ? {
          kicker: "नई शुरुआत",
          title: "पहला बिल जल्दी बनाने के लिए यह करें",
          description: "अगर आप पहली बार Bill Sutra चला रहे हैं, तो बस नीचे के स्टेप पूरे करें।",
          demo: demoSeeded ? "डेमो डेटा फिर जोड़ें" : "डेमो डेटा जोड़ें",
        }
      : language === "hinglish"
        ? {
            kicker: "Nayi shuruaat",
            title: "Pehla bill jaldi banane ke liye ye steps follow kijiye",
            description: "Agar aap pehli baar Bill Sutra use kar rahe hain, to bas neeche ke steps complete kijiye.",
            demo: demoSeeded ? "Demo data phir jodiye" : "Demo data jodiye",
          }
        : {
            kicker: "New here",
            title: "Follow these steps to create your first bill fast",
            description: "If this is your first time using Bill Sutra, just complete the steps below.",
            demo: demoSeeded ? "Add demo data again" : "Load demo data",
          };

  const steps = [
    {
      label:
        language === "hi"
          ? "अपनी दुकान की जानकारी जोड़ें"
          : language === "hinglish"
            ? "Apni dukaan ki details jodiye"
            : "Add your business details",
      done: progress.businessReady,
      href: "/business-profile",
    },
    {
      label:
        language === "hi"
          ? "कम से कम एक प्रोडक्ट जोड़ें"
          : language === "hinglish"
            ? "Kam se kam ek product jodiye"
            : "Add at least one product",
      done: progress.productsReady,
      href: "/products",
    },
    {
      label:
        language === "hi"
          ? "एक ग्राहक जोड़ें"
          : language === "hinglish"
            ? "Ek customer jodiye"
            : "Add one customer",
      done: progress.customersReady,
      href: "/customers",
    },
    {
      label:
        language === "hi"
          ? "अपना पहला बिल बनाएं"
          : language === "hinglish"
            ? "Apna pehla bill banaiye"
            : "Create your first bill",
      done: progress.billsReady,
      href: "/invoices",
    },
  ];

  const completedSteps = steps.filter((step) => step.done).length;

  return (
    <section className="rounded-[2rem] border border-[#eadfcf] bg-[linear-gradient(135deg,#fff8ec_0%,#fffdf8_45%,#f8fbff_100%)] p-6 shadow-[0_26px_60px_-42px_rgba(15,23,42,0.22)] dark:border-[#3f3428] dark:bg-[linear-gradient(135deg,rgba(47,37,21,0.55)_0%,rgba(15,23,42,0.9)_100%)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-200">
            {copy.kicker}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {copy.description}
          </p>
        </div>

        <div className="rounded-[1.4rem] border border-white/80 bg-white/80 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/50">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Setup progress
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">
            {completedSteps}/4
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className={cn(
              "rounded-[1.4rem] border px-4 py-4 transition hover:-translate-y-0.5",
              step.done
                ? "border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100"
                : "border-slate-200 bg-white/85 text-slate-900 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-100",
            )}
          >
            <div className="flex items-center gap-3">
              {step.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              <span className="font-medium">{step.label}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-200 dark:ring-slate-700">
          <ReceiptText size={16} />
          <span>
            {completedSteps < 4
              ? language === "hi"
                ? "थोड़ा सा सेटअप बाकी है, फिर पहला बिल बहुत आसान होगा।"
                : language === "hinglish"
                  ? "Thoda sa setup baaki hai, phir pehla bill bahut easy ho jayega."
                  : "A little setup now will make the first bill much easier."
              : language === "hi"
                ? "सब तैयार है। अब आप सीधे बिल बना सकते हैं।"
                : language === "hinglish"
                  ? "Sab tayyar hai. Ab aap seedha bill bana sakte hain."
                  : "Everything is ready. You can create bills right away."}
          </span>
        </div>
        <Button type="button" variant="outline" onClick={onSeedDemo} disabled={isSeedingDemo}>
          {isSeedingDemo ? "..." : copy.demo}
        </Button>
      </div>
    </section>
  );
};

export default SetupProgressCard;
