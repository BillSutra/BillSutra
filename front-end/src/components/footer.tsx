"use client";

import Link from "next/link";
import { useI18n } from "@/providers/LanguageProvider";

const Footer = () => {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border bg-background py-12 text-foreground">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="text-lg font-semibold">{t("common.appName")}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("landing.footer.description")}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("landing.footer.product")}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="#features">{t("landing.footer.links.features")}</Link>
              </li>
              <li>
                <Link href="#pricing">{t("landing.footer.links.pricing")}</Link>
              </li>
              <li>
                <Link href="#updates">{t("landing.footer.links.updates")}</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("landing.footer.company")}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="#about">{t("landing.footer.links.about")}</Link>
              </li>
              <li>
                <Link href="#contact">{t("landing.footer.links.contact")}</Link>
              </li>
              <li>
                <Link href="#careers">{t("landing.footer.links.careers")}</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("landing.footer.resources")}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="#docs">
                  {t("landing.footer.links.documentation")}
                </Link>
              </li>
              <li>
                <Link href="#blog">{t("landing.footer.links.blog")}</Link>
              </li>
              <li>
                <Link href="#help">{t("landing.footer.links.helpCenter")}</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("landing.footer.legal")}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="#privacy">{t("landing.footer.links.privacy")}</Link>
              </li>
              <li>
                <Link href="#terms">{t("landing.footer.links.terms")}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
          {t("landing.footer.copyright")}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
