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
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] border border-[#d9e6f4] bg-white p-2 shadow-[0_18px_36px_-28px_rgba(17,37,63,0.35)]",
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
        <div className="truncate text-base font-semibold tracking-tight text-[#123d65]">
          {BRAND_NAME}
        </div>
        {showTagline ? (
          <div className="text-[0.64rem] font-semibold uppercase tracking-[0.24em] text-[#7a8ea4]">
            Trusted billing operations
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BrandLogo;
