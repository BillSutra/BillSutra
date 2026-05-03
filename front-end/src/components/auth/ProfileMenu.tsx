"use client";

import React, { Suspense, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserAvtar from "../common/UserAvtar";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  HelpCircle,
  Languages,
  LogOut,
  Palette,
  Settings,
  UserRound,
} from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";
import { usePersistedLanguage } from "@/hooks/usePersistedLanguage";
import { useHydrated } from "@/hooks/useHydrated";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/theme-provider";
const LogoutModalDynamic = dynamic(() => import("../auth/LogoutModal"));
const ProfileMenu = ({
  name,
  image,
  onOpenHelp,
}: {
  name: string;
  image?: string;
  onOpenHelp?: () => void;
}) => {
  const [logoutopen, setLogoutOpen] = useState(false);
  const hydrated = useHydrated();
  const { t } = useI18n();
  const { language, setPersistedLanguage } = usePersistedLanguage();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const isWorkerAccount = session?.user?.accountType === "WORKER";
  const profileHref = isWorkerAccount ? "/worker-panel" : "/profile";
  const email = session?.user?.email ?? "Workspace account";
  const roleLabel =
    session?.user?.accountType === "WORKER" || session?.user?.role === "WORKER"
      ? "Worker"
      : session?.user?.role === "ADMIN"
        ? "Admin"
        : "Owner";

  if (!hydrated) {
    return <UserAvtar name={name} image={image} />;
  }
  return (
    <div>
      {logoutopen && (
        <Suspense fallback={<div>Loading...</div>}>
          <LogoutModalDynamic open={logoutopen} setOpen={setLogoutOpen} />
        </Suspense>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-full outline-none ring-offset-background transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={t("profileMenu.myAccount")}
          >
            <UserAvtar name={name} image={image} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-[260px] rounded-xl border-slate-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <DropdownMenuLabel className="p-2">
            <div className="flex items-center gap-3">
              <UserAvtar name={name} image={image} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                  {name}
                </p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {email}
                </p>
                <span className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  {roleLabel}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuItem asChild className="rounded-lg px-3 py-2.5">
            <Link href={profileHref}>
              <UserRound className="h-4 w-4" />
              {t("profileMenu.profile")}
            </Link>
          </DropdownMenuItem>
          {!isWorkerAccount ? (
            <>
              <DropdownMenuItem asChild className="rounded-lg px-3 py-2.5">
                <Link href="/business-profile">
                  <Building2 className="h-4 w-4" />
                  {t("navigation.businessProfile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-lg px-3 py-2.5">
                <Link href="/pricing">
                  <CreditCard className="h-4 w-4" />
                  {t("landing.nav.pricing")}
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="rounded-lg px-3 py-2.5">
              <Languages className="h-4 w-4" />
              {t("profileMenu.languageSection")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44 rounded-xl border-slate-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
              <DropdownMenuRadioGroup
                value={language}
                onValueChange={(value) =>
                  setPersistedLanguage(value as "en" | "hi")
                }
              >
                <DropdownMenuRadioItem value="en" className="rounded-lg py-2">
                  {t("common.english")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="hi" className="rounded-lg py-2">
                  {t("common.hindi")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="rounded-lg px-3 py-2.5">
              <Palette className="h-4 w-4" />
              {t("themeToggle.toggleTheme")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-40 rounded-xl border-slate-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) =>
                  setTheme(value as "light" | "dark" | "system")
                }
              >
                <DropdownMenuRadioItem value="light" className="rounded-lg py-2">
                  {t("themeToggle.light")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" className="rounded-lg py-2">
                  {t("themeToggle.dark")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system" className="rounded-lg py-2">
                  {t("themeToggle.system")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem asChild className="rounded-lg px-3 py-2.5">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              {t("profileMenu.preferences")}
            </Link>
          </DropdownMenuItem>
          {onOpenHelp ? (
            <DropdownMenuItem
              className="rounded-lg px-3 py-2.5"
              onClick={onOpenHelp}
            >
              <HelpCircle className="h-4 w-4" />
              {t("profileMenu.helpCenter")}
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuItem
            variant="destructive"
            className="rounded-lg px-3 py-2.5"
            onClick={() => {
              setLogoutOpen(true);
            }}
          >
            <LogOut className="h-4 w-4" />
            {t("profileMenu.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ProfileMenu;
