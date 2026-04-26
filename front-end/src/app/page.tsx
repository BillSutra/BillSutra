import Navbar from "@/components/navbar";
import Hero from "@/components/hero";
import Features from "@/components/features";
import ProductPreview from "@/components/product-preview";
import HowItWorks from "@/components/how-it-works";
import Benefits from "@/components/benefits";
import Cta from "@/components/cta";
import Footer from "@/components/footer";
import Testimonials from "@/components/testimonials";
import TrustStrip from "@/components/trust-strip";
import AIAssistantSection from "@/components/ai-assistant-section";
import FloatingAiCta from "@/components/floating-ai-cta";
import AccountDeletedNotice from "@/components/account/AccountDeletedNotice";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { authOptions, CustomSession } from "./api/auth/[...nextauth]/options";

export const metadata: Metadata = {
  title: "BillSutra | Billing, Inventory, and Analytics for Growing Businesses",
  description:
    "BillSutra helps businesses manage billing, inventory, and analytics from one modern bilingual workspace.",
};

export default async function LandingPage() {
  const session: CustomSession | null = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/dashboard");
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AccountDeletedNotice />
      <Navbar />
      <Hero />
      <TrustStrip />
      <Benefits />
      <ProductPreview />
      <Features />
      <AIAssistantSection />
      <Testimonials />
      <HowItWorks />
      <Cta />
      <Footer />
      <FloatingAiCta />
    </div>
  );
}
