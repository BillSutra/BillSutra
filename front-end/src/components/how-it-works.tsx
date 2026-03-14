import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    step: "Step 1",
    title: "Add your products and customers",
    description: "Import your catalog and customer list in minutes.",
  },
  {
    step: "Step 2",
    title: "Create invoices and record purchases",
    description: "Generate invoices fast and track supplier bills.",
  },
  {
    step: "Step 3",
    title: "Track your business performance with analytics",
    description: "Use real-time dashboards to make smarter decisions.",
  },
];

const HowItWorks = () => {
  return (
    <section className="bg-background py-16 text-foreground">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            How it works
          </p>
          <h2 className="text-3xl font-semibold">Get started in three steps</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.step} className="border-border bg-card">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {step.step}
                </p>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
