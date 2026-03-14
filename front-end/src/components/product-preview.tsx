import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

const ProductPreview = () => {
  return (
    <section id="product" className="bg-background py-16">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Product preview
          </p>
          <h2 className="text-3xl font-semibold">
            Everything your business needs in one dashboard.
          </h2>
          <p className="text-sm text-muted-foreground">
            Stay on top of outstanding invoices, supplier payables, and stock
            positions with real-time analytics tailored for small teams.
          </p>
          <div className="grid gap-3 text-sm text-muted-foreground">
            {[
              "Unified dashboard for billing and inventory",
              "Automated reminders for pending payments",
              "Instant insights into sales and profit",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-border bg-card/90 shadow-xl">
          <CardContent className="p-6">
            <div className="rounded-2xl border border-dashed border-border bg-muted/60 p-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>BillSutra Dashboard</span>
                <span>Preview</span>
              </div>
              <div className="mt-6 grid gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-16 rounded-xl bg-card shadow-sm" />
                  <div className="h-16 rounded-xl bg-card shadow-sm" />
                  <div className="h-16 rounded-xl bg-card shadow-sm" />
                </div>
                <div className="h-32 rounded-2xl bg-card shadow-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-20 rounded-2xl bg-card shadow-sm" />
                  <div className="h-20 rounded-2xl bg-card shadow-sm" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default ProductPreview;
