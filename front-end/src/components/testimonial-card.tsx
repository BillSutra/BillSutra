"use client";

import { Quote, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type TestimonialCardProps = {
  quote: string;
  name: string;
  role: string;
  initials: string;
  accent: string;
};

const TestimonialCard = ({
  quote,
  name,
  role,
  initials,
  accent,
}: TestimonialCardProps) => {
  return (
    <article className="group rounded-[1.85rem] border border-slate-200 bg-white p-6 shadow-[0_26px_60px_-46px_rgba(15,23,42,0.12)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_32px_72px_-48px_rgba(15,23,42,0.16)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-[0_26px_58px_-42px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl border text-sm font-semibold shadow-[0_18px_32px_-26px_rgba(15,23,42,0.2)]",
              accent,
            )}
          >
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-white">
              {name}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              {role}
            </p>
          </div>
        </div>
        <Quote className="h-5 w-5 text-slate-300 dark:text-zinc-700" />
      </div>

      <div className="mt-5 flex items-center gap-1 text-amber-500">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className="h-4 w-4 fill-current" />
        ))}
      </div>

      <p className="mt-4 text-base leading-7 text-slate-700 dark:text-zinc-300">
        {quote}
      </p>
    </article>
  );
};

export default TestimonialCard;
