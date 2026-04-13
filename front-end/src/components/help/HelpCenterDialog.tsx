"use client";

import Link from "next/link";
import { BookOpenText, CircleHelp, LifeBuoy, PlayCircle } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";

type HelpCenterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplayOnboarding: () => void;
  onSeedDemo: () => void;
  isSeedingDemo?: boolean;
  demoSeeded?: boolean;
};

const HelpCenterDialog = ({
  open,
  onOpenChange,
  onReplayOnboarding,
  onSeedDemo,
  isSeedingDemo = false,
  demoSeeded = false,
}: HelpCenterDialogProps) => {
  const { language } = useI18n();

  const copy =
    language === "hi"
      ? {
          title: "मदद और शुरुआत",
          description:
            "नई शुरुआत के लिए छोटे गाइड, अक्सर पूछे जाने वाले सवाल, और पहला बिल बनाने के आसान स्टेप यहां हैं।",
          firstBill: "पहला बिल कैसे बनाएं",
          firstBillSteps: [
            "1. पहले अपना बिजनेस नाम और फोन भरें।",
            "2. फिर कम से कम एक प्रोडक्ट जोड़ें।",
            "3. बिल्स पेज खोलें और ग्राहक चुनें।",
            "4. प्रोडक्ट जोड़ें और आख़िर में बिल बनाएं।",
          ],
          tutorials: "झटपट गाइड",
          guideBusiness: "बिजनेस डिटेल्स जोड़ें",
          guideProducts: "पहला प्रोडक्ट जोड़ें",
          guideBills: "पहला बिल बनाएं",
          faq: "अक्सर पूछे जाने वाले सवाल",
          faqOneQ: "क्या मुझे पहले सब कुछ भरना होगा?",
          faqOneA:
            "नहीं। बिजनेस नाम, एक प्रोडक्ट और एक ग्राहक से शुरुआत हो सकती है।",
          faqTwoQ: "अगर मेरे पास अभी असली डेटा नहीं है तो?",
          faqTwoA:
            "आप डेमो डेटा डाल सकते हैं और बाद में उसे बदल या हटा सकते हैं।",
          faqThreeQ: "क्या यह मोबाइल पर भी आसान रहेगा?",
          faqThreeA:
            "हां। मुख्य बटन बड़े रखे गए हैं और पहला बिल मोबाइल पर भी आसान है।",
          replay: "ऑनबोर्डिंग फिर से देखें",
          demo: demoSeeded ? "डेमो डेटा फिर जोड़ें" : "डेमो डेटा जोड़ें",
          support:
            "अगर कहीं अटकें, तो पहले डैशबोर्ड के Quick Actions और ऊपर Help बटन देखें।",
        }
      : {
          title: "Help & Getting Started",
          description:
            "Short tutorials, common questions, and a simple first-bill guide for new users.",
          firstBill: "How to create your first bill",
          firstBillSteps: [
            "1. Add your business name and phone number.",
            "2. Add at least one product you sell.",
            "3. Open the Bills page and choose a customer.",
            "4. Add products, review the total, and generate the bill.",
          ],
          tutorials: "Quick guides",
          guideBusiness: "Add business details",
          guideProducts: "Add your first product",
          guideBills: "Create your first bill",
          faq: "FAQs",
          faqOneQ: "Do I need to set up everything first?",
          faqOneA:
            "No. You can start with your business name, one product, and one customer.",
          faqTwoQ: "What if I do not have real data yet?",
          faqTwoA: "You can load demo data now and edit or delete it later.",
          faqThreeQ: "Will this stay easy on mobile?",
          faqThreeA:
            "Yes. The main actions stay large, clear, and easy to tap.",
          replay: "Replay onboarding",
          demo: demoSeeded ? "Add demo data again" : "Load demo data",
          support:
            "If you feel stuck, start with the dashboard quick actions and the Help button in the top bar.",
        };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      contentClassName="max-w-4xl"
    >
      <div className="grid gap-5">
        <section className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50/80 p-5 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
          <div className="flex items-start gap-3">
            <BookOpenText className="mt-0.5 h-5 w-5" />
            <div>
              <h3 className="text-lg font-semibold">{copy.firstBill}</h3>
              <div className="mt-3 grid gap-2 text-sm leading-6">
                {copy.firstBillSteps.map((step) => (
                  <p key={step}>{step}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              href: "/business-profile",
              title: copy.guideBusiness,
              icon: CircleHelp,
            },
            {
              href: "/products",
              title: copy.guideProducts,
              icon: PlayCircle,
            },
            {
              href: "/invoices",
              title: copy.guideBills,
              icon: LifeBuoy,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 dark:border-slate-700 dark:bg-slate-950/60"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-primary dark:bg-slate-900">
                  <Icon size={18} />
                </div>
                <p className="mt-4 font-semibold text-slate-950 dark:text-slate-100">
                  {item.title}
                </p>
              </Link>
            );
          })}
        </section>

        <section className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/60">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
            {copy.faq}
          </h3>
          <div className="mt-4 grid gap-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <div>
              <p className="font-semibold text-slate-950 dark:text-slate-100">
                {copy.faqOneQ}
              </p>
              <p className="mt-1">{copy.faqOneA}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-950 dark:text-slate-100">
                {copy.faqTwoQ}
              </p>
              <p className="mt-1">{copy.faqTwoA}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-950 dark:text-slate-100">
                {copy.faqThreeQ}
              </p>
              <p className="mt-1">{copy.faqThreeA}</p>
            </div>
          </div>
        </section>

        <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
          {copy.support}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onReplayOnboarding}>
            {copy.replay}
          </Button>
          <Button type="button" onClick={onSeedDemo} disabled={isSeedingDemo}>
            {isSeedingDemo ? "..." : copy.demo}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default HelpCenterDialog;
