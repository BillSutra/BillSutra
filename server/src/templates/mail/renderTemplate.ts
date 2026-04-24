import Handlebars from "handlebars";

const handlebars = Handlebars.create();

handlebars.registerHelper("formatCurrency", (value: unknown, currency = "INR") => {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
});

handlebars.registerHelper("formatDate", (value: unknown) => {
  if (!value) return "-";

  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
});

export const renderTemplate = <T extends object>(template: string, data: T) => {
  return handlebars.compile(template)(data);
};

export const toSafeHtml = (value: string) => new Handlebars.SafeString(value);
