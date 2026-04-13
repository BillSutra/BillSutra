import Link from "next/link";
import { ArrowRight, BadgeCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type PlanManagementCardProps = {
  title?: string;
  description?: string;
  compact?: boolean;
};

const PlanManagementCard = ({
  title = "Plans and pricing",
  description = "Keep pricing close to your account settings so you can review INR plans, compare limits, and upgrade at the right time.",
  compact = false,
}: PlanManagementCardProps) => {
  return (
    <section className="rounded-3xl border border-[#d8d3ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,241,255,0.96))] p-6 shadow-[0_24px_80px_-56px_rgba(79,70,229,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6d5bb3]">
            Billing and plans
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[#1f1b16]">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f566d]">
            {description}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#d8d3ff] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#5b4db0]">
          <Sparkles className="size-3.5" />
          INR plans for Indian SMBs
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Free for adoption
        </span>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          Pro for active billing
        </span>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
          Pro Plus for advanced teams
        </span>
      </div>

      {!compact ? (
        <div className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-4 text-sm text-[#4f4859]">
          <div className="flex items-start gap-2.5">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#5b4db0]" />
            <p>
              Start on Free, watch your invoice and product limits, then upgrade
              only when your workflow needs smarter suggestions, better PDFs, or
              deeper reporting for your growing business.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/payments">
            Manage payments
            <ArrowRight size={16} />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/business-profile">Open business profile</Link>
        </Button>
      </div>
    </section>
  );
};

export default PlanManagementCard;
