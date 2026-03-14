import Link from "next/link";
import { Button } from "@/components/ui/button";

const Cta = () => {
  return (
    <section className="bg-background py-16">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="rounded-3xl border border-border bg-foreground px-8 py-10 text-background shadow-xl">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-background/70">
                Ready to start
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Start Managing Your Business Today
              </h2>
              <p className="mt-2 text-sm text-background/70">
                Join thousands of small businesses using BillSutra to simplify
                billing and inventory.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="bg-background text-foreground hover:bg-muted"
              >
                <Link href="/register">Get Started Free</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-background text-background hover:bg-background/10"
              >
                <Link href="#product">Book Demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Cta;
