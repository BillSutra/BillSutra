"use client";

import Link from "next/link";
import { Instagram, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import BrandLogo from "@/components/branding/BrandLogo";
import { useI18n } from "@/providers/LanguageProvider";

const Footer = () => {
  const { t } = useI18n();

  return (
    <footer
      id="contact"
      className="border-t border-[#dce7f1] bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_100%)] py-14 text-foreground"
    >
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
          <div className="space-y-4">
            <BrandLogo priority className="max-w-max" />
            <p className="max-w-sm text-sm leading-6 text-[#627890]">
              {t("landing.footer.description")}
            </p>
            <div className="space-y-2 text-sm text-[#546a80]">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[#123d65]" />
                <span>{t("landing.footer.contactEmail")}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[#123d65]" />
                <span>{t("landing.footer.contactPhone")}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-[#123d65]" />
                <span>{t("landing.footer.contactLocation")}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Link
                href="#linkedin"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce7f1] bg-white text-[#123d65] transition hover:-translate-y-0.5 hover:shadow-md"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </Link>
              <Link
                href="#instagram"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce7f1] bg-white text-[#123d65] transition hover:-translate-y-0.5 hover:shadow-md"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ea4]">
              {t("landing.footer.product")}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-[#546a80]">
              <li>
                <Link href="#features">{t("landing.footer.links.features")}</Link>
              </li>
              <li>
                <Link href="#product">{t("landing.footer.links.productTour")}</Link>
              </li>
              <li>
                <Link href="#pricing">{t("landing.footer.links.pricing")}</Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ea4]">
              {t("landing.footer.company")}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-[#546a80]">
              <li>
                <Link href="#how-it-works">{t("landing.footer.links.about")}</Link>
              </li>
              <li>
                <Link href="#contact">{t("landing.footer.links.contact")}</Link>
              </li>
              <li>
                <Link href="#testimonials">{t("landing.footer.links.customers")}</Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ea4]">
              {t("landing.footer.resources")}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-[#546a80]">
              <li>
                <Link href="#docs">{t("landing.footer.links.documentation")}</Link>
              </li>
              <li>
                <Link href="#pricing">{t("landing.footer.links.pricingGuide")}</Link>
              </li>
              <li>
                <Link href="#features">{t("landing.footer.links.helpCenter")}</Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ea4]">
              {t("landing.footer.legal")}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-[#546a80]">
              <li>
                <Link href="#privacy">{t("landing.footer.links.privacy")}</Link>
              </li>
              <li>
                <Link href="#terms">{t("landing.footer.links.terms")}</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-[#dce7f1] pt-6 text-sm text-[#73879b]">
          {t("landing.footer.copyright")}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
