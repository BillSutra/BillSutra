const benefits = [
  "Save Time",
  "Improve Cash Flow",
  "Reduce Manual Work",
  "Grow Your Business",
];

const Benefits = () => {
  return (
    <section className="bg-background py-16 text-foreground">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Benefits
          </p>
          <h2 className="text-3xl font-semibold">Built for modern teams</h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <div
              key={benefit}
              className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm font-semibold shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              {benefit}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Benefits;
