"use client";
import Link from "next/link";
import { CustomUser } from "@/app/api/auth/[...nextauth]/options";
import { Button } from "../ui/button";
import ThemeToggle from "@/components/theme-toggle";
import LoginModel from "../auth/LoginModal";
// import LoginModal from "../auth/LoginModal";
export default function Navbar({ user }: { user?: CustomUser | null }) {
  return (
    <nav className="w-full border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent" />
          <div>
            <div className="text-xl font-extrabold">BillSutra</div>
            <div className="text-xs font-medium text-muted-foreground">
              GST Billing for SMBs
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="#mobile" className="hover:text-foreground">
            Try mobile app
          </Link>
          <Link href="#solutions" className="hover:text-foreground">
            Solutions
          </Link>
          <Link href="#pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="#about" className="hover:text-foreground">
            About Us
          </Link>
          <Link href="#desktop" className="hover:text-foreground">
            Desktop
          </Link>
          <Link href="#careers" className="hover:text-foreground">
            Careers
          </Link>
          <Link href="#partner" className="hover:text-foreground">
            Partner with us
          </Link>
          <ThemeToggle />
          {!user ? (
            <LoginModel />
          ) : (
            <Link href="/dashboard">
              <Button>Dashboard</Button>
            </Link>
          )}
        </div>
        <div className="md:hidden">
          <ThemeToggle />
          {!user ? (
            <LoginModel />
          ) : (
            <Link href="/dashboard">
              <Button>Dashboard</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
