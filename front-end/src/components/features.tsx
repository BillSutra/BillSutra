import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Boxes, Users, Truck, LineChart, Receipt } from "lucide-react";

const features = [
  {
    title: "Invoice Management",
    description: "Create and print invoices instantly",
    icon: Receipt,
  },
  {
    title: "Inventory Tracking",
    description: "Track product stock and get low stock alerts",
    icon: Boxes,
  },
  {
    title: "Customer Management",
    description: "Manage customer records and transactions",
    icon: Users,
  },
  {
    title: "Supplier Management",
    description: "Track purchases and supplier payments",
    icon: Truck,
  },
  {
    title: "Business Analytics",
    description: "Understand sales, profit and performance",
    icon: LineChart,
  },
  {
    title: "Payment Tracking",
    description: "Monitor pending payments and cash flow",
    icon: Wallet,
  },
];

const Features = () => {
  return (
    <section id="features" className="bg-background py-16 text-foreground">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Trusted by growing businesses
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground sm:grid-cols-4">
            {["StudioNine", "KiteSupply", "UrbanMart", "ByteCraft"].map(
              (brand) => (
                <div
                  key={brand}
                  className="rounded-full border border-border bg-card px-4 py-2 text-center"
                >
                  {brand}
                </div>
              ),
            )}
          </div>
        </div>

        <div className="mt-12 flex items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-semibold">Everything you need</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              One workspace to handle invoices, inventory, and cash flow without
              juggling spreadsheets.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <feature.icon size={18} />
                </span>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
