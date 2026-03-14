import Navbar from "@/components/navbar";
import Hero from "@/components/hero";
import Features from "@/components/features";
import ProductPreview from "@/components/product-preview";
import HowItWorks from "@/components/how-it-works";
import Benefits from "@/components/benefits";
import Cta from "@/components/cta";
import Footer from "@/components/footer";
import Pricing from "@/components/pricing";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, CustomSession } from "./api/auth/[...nextauth]/options";
export default async function LandingPage() {
  const session: CustomSession | null = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/dashboard");
  }
  return (
    <div className="min-h-screen bg-[#f7f2ea] text-[#1f1b16] dark:bg-slate-950 dark:text-white">
      <Navbar />
      <Hero />
      <Features />
      <ProductPreview />
      <HowItWorks />
      <Benefits />
      <Pricing />
      <Cta />
      <Footer />
    </div>
  );
}
