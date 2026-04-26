import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  iconClassName?: string;
  priority?: boolean;
  showTagline?: boolean;
  textClassName?: string;
  variant?: "header" | "icon" | "lockup";
};

const BRAND_NAME = "BillSutra";

const BrandLogo = ({
  className,
  iconClassName,
  priority = false,
  showTagline = true,
  textClassName,
  variant = "header",
}: BrandLogoProps) => {
  if (variant === "lockup") {
    return (
      <div className={cn("relative", className)} aria-label={BRAND_NAME}>
        <Image
          src="/brand-lockup.png"
          alt="BillSutra official logo"
          width={720}
          height={590}
          priority={priority}
          sizes="(max-width: 768px) 220px, 320px"
          className="h-auto w-full object-contain"
        />
      </div>
    );
  }

  const icon = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[1.1rem] border border-slate-200 bg-white p-2 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.16)] ring-1 ring-black/5 transition-all duration-200 dark:border-zinc-200/90 dark:bg-zinc-100 dark:shadow-[0_14px_28px_-22px_rgba(0,0,0,0.42)] dark:ring-white/10",
        variant === "icon" ? "h-14 w-14" : "h-11 w-11 sm:h-12 sm:w-12",
        iconClassName,
      )}
    >
      <Image
        src="/brand-icon.png"
        alt=""
        width={256}
        height={256}
        priority={priority}
        sizes={variant === "icon" ? "56px" : "(max-width: 640px) 44px, 48px"}
        className="h-full w-full object-contain"
      />
    </span>
  );

  if (variant === "icon") {
    return (
      <div className={cn("inline-flex", className)} aria-label={BRAND_NAME}>
        {icon}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)} aria-label={BRAND_NAME}>
      {icon}
      <div className={cn("min-w-0", textClassName)}>
        <div className="truncate text-base font-semibold tracking-[0.01em] text-slate-900 dark:text-white">
          {BRAND_NAME}
        </div>
        {showTagline ? (
          <div className="text-[0.64rem] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-400">
            Trusted billing operations
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BrandLogo;
