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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserAvtar from "../common/UserAvtar";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Languages } from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";
import { usePersistedLanguage } from "@/hooks/usePersistedLanguage";
import { useHydrated } from "@/hooks/useHydrated";
const LogoutModalDynamic = dynamic(() => import("../auth/LogoutModal"));
const ProfileMenu = ({ name, image }: { name: string; image?: string }) => {
  const [logoutopen, setLogoutOpen] = useState(false);
  const hydrated = useHydrated();
  const { t } = useI18n();
  const { language, setPersistedLanguage } = usePersistedLanguage();

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
        <DropdownMenuTrigger>
          <UserAvtar name={name} image={image} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>{t("profileMenu.myAccount")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">{t("profileMenu.profile")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/pricing">{t("landing.nav.pricing")}</Link>
          </DropdownMenuItem>
          <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
            <Languages className="h-3.5 w-3.5" />
            {t("profileMenu.languageSection")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={language}
            onValueChange={(value) =>
              setPersistedLanguage(value as "en" | "hi")
            }
          >
            <DropdownMenuRadioItem value="en">
              {t("common.english")}
              <span className="ml-auto text-xs text-muted-foreground">
                {t("profileMenu.languageEnglish")}
              </span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="hi">
              {t("common.hindi")}
              <span className="ml-auto text-xs text-muted-foreground">
                {t("profileMenu.languageHindi")}
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setLogoutOpen(true);
            }}
          >
            {t("profileMenu.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default ProfileMenu;
