"use client";

import Link from "next/link";
import { Building2, PackagePlus, ReceiptText, Sparkles } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import LanguageToggle from "@/components/language-toggle";
import { useI18n } from "@/providers/LanguageProvider";

type BeginnerOnboardingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  onSeedDemo: () => void;
  demoSeeded?: boolean;
  isSeedingDemo?: boolean;
};

const BeginnerOnboardingModal = ({
  open,
  onOpenChange,
  onComplete,
  onSeedDemo,
  demoSeeded = false,
  isSeedingDemo = false,
}: BeginnerOnboardingModalProps) => {
  const { language } = useI18n();

  const copy =
    language === "hi"
      ? {
          title: "Bill Sutra में आपका स्वागत है",
          description: "पहला बिल जल्दी बनाने के लिए बस इन चार आसान स्टेप्स को फॉलो करें।",
          steps: [
            {
              title: "शुरुआत आसान रखें",
              description: "यह ऐप छोटे दुकानदारों और बिजनेस मालिकों के लिए बनाया गया है। सब कुछ आसान भाषा में रखा गया है।",
            },
            {
              title: "अपनी दुकान की जानकारी जोड़ें",
              description: "सबसे पहले बिजनेस नाम, फोन नंबर और पता भरें ताकि आपके बिल तैयार रहें।",
              href: "/business-profile",
              cta: "बिजनेस डिटेल्स जोड़ें",
            },
            {
              title: "अपना पहला प्रोडक्ट जोड़ें",
              description: "जो सामान आप बेचते हैं, उसका नाम और कीमत भर दें। इतना काफी है।",
              href: "/products",
              cta: "प्रोडक्ट जोड़ें",
            },
            {
              title: "अब पहला बिल बनाएं",
              description: "ग्राहक चुनें, प्रोडक्ट जोड़ें और बिल तैयार करें। आम तौर पर यह दो मिनट के अंदर हो सकता है।",
              href: "/invoices",
              cta: "पहला बिल बनाएं",
            },
          ],
            sample: demoSeeded ? "डेमो डेटा फिर जोड़ें" : "डेमो डेटा जोड़ें",
            finish: "शुरू करें",
            demoDescription:
              "अगर आप पहले ऐप देखना चाहते हैं, तो सैंपल प्रोडक्ट और सैंपल बिल जोड़ सकते हैं। आप उन्हें कभी भी बदल या हटा सकते हैं।",
          }
      : language === "hinglish"
        ? {
            title: "Bill Sutra mein aapka swagat hai",
            description: "Pehla bill jaldi banane ke liye bas in chaar easy steps ko follow kijiye.",
            steps: [
              {
                title: "Shuruaat simple rakhiye",
                description: "Ye app dukandaron aur small business owners ke liye bana hai. Sab kuch seedhi bhaasha mein rakha gaya hai.",
              },
              {
                title: "Apni dukaan ki details jodiye",
                description: "Sabse pehle business naam, phone number, aur address bhariye taki aapke bills ready rahein.",
                href: "/business-profile",
                cta: "Business details jodiye",
              },
              {
                title: "Pehla product jodiye",
                description: "Jo saman aap bechte hain, uska naam aur price bhar dijiye. Itna hi kaafi hai.",
                href: "/products",
                cta: "Product jodiye",
              },
              {
                title: "Ab pehla bill banaiye",
                description: "Customer chuniye, product jodiye, aur bill generate kijiye. Aksar ye 2 minute ke andar ho sakta hai.",
                href: "/invoices",
                cta: "Pehla bill banaiye",
              },
            ],
            sample: demoSeeded ? "Demo data phir jodiye" : "Demo data jodiye",
            finish: "Shuru karein",
            demoDescription:
              "Agar aap pehle app try karna chahte hain, to sample products aur sample bill load kar sakte hain. Aap unhe kabhi bhi edit ya delete kar sakte hain.",
          }
        : {
            title: "Welcome to Bill Sutra",
            description: "Follow these four simple steps to create your first bill fast.",
            steps: [
              {
                title: "Keep the first setup simple",
                description: "This app is made for shopkeepers and small business owners, so everything is written in plain language.",
              },
              {
                title: "Add your business details",
                description: "Start with your business name, phone number, and address so your bills are ready to use.",
                href: "/business-profile",
                cta: "Add business details",
              },
              {
                title: "Add your first product",
                description: "Enter the name and price of something you sell. That is enough to begin.",
                href: "/products",
                cta: "Add product",
              },
              {
                title: "Create your first bill",
                description: "Choose a customer, add products, and generate the bill. Most people can do this in under two minutes.",
                href: "/invoices",
                cta: "Create first bill",
              },
            ],
            sample: demoSeeded ? "Add demo data again" : "Load demo data",
            finish: "Start now",
            demoDescription:
              "If you want to try the app first, load sample products and a sample bill. You can edit or delete them anytime.",
          };

  const icons = [Sparkles, Building2, PackagePlus, ReceiptText];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      contentClassName="max-w-5xl"
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              English / Hindi / Hinglish
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose the language that feels easiest right now.
            </p>
          </div>
          <LanguageToggle />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {copy.steps.map((step, index) => {
            const Icon = icons[index] ?? Sparkles;

            return (
              <section
                key={step.title}
                className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/60"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-primary dark:bg-slate-900">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {step.description}
                    </p>
                    {step.href && step.cta ? (
                      <div className="mt-4">
                        <Button asChild variant="outline">
                          <Link href={step.href}>{step.cta}</Link>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-[1.6rem] border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            {copy.demoDescription}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onSeedDemo} disabled={isSeedingDemo}>
              {isSeedingDemo ? "..." : copy.sample}
            </Button>
            <Button type="button" onClick={onComplete}>
              {copy.finish}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default BeginnerOnboardingModal;
