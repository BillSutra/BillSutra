const PricingPlaceholder = () => {
  return (
    <section id="pricing" className="bg-background py-16">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Pricing
          </p>
          <h2 className="text-3xl font-semibold">
            Simple plans for growing teams
          </h2>
          <p className="text-sm text-muted-foreground">
            Talk to us for the plan that fits your business size.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              name: "Starter",
              price: "Free",
              desc: "For early stage businesses",
            },
            { name: "Growth", price: "₹1,499/mo", desc: "For scaling teams" },
            { name: "Pro", price: "Custom", desc: "For multi-location ops" },
          ].map((tier) => (
            <div
              key={tier.name}
              className="rounded-2xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {tier.name}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {tier.price}
              </p>
              <p className="mt-2">{tier.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingPlaceholder;
