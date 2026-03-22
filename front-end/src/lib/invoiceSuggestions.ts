import type { Invoice, Product } from "@/lib/apiClient";

export type RecentProductUsage = {
  productId: string;
  count: number;
  lastAddedAt: string;
};

export type SmartSuggestionProduct = {
  product: Product;
  reasonLabel: string;
  reasonNote: string;
  score: number;
};

const clampMargin = (product: Product) => {
  const price = Number(product.price ?? 0);
  const cost = Number(product.cost ?? 0);

  if (!Number.isFinite(price) || price <= 0) return 0;
  if (!Number.isFinite(cost) || cost <= 0) return 0;

  return Math.max(0, (price - cost) / price);
};

export const updateRecentProductUsage = (
  currentUsage: RecentProductUsage[],
  productId: string,
  at = new Date().toISOString(),
) => {
  const nextMap = new Map(
    currentUsage.map((entry) => [entry.productId, entry] as const),
  );
  const existing = nextMap.get(productId);

  nextMap.set(productId, {
    productId,
    count: (existing?.count ?? 0) + 1,
    lastAddedAt: at,
  });

  return Array.from(nextMap.values())
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return (
        new Date(right.lastAddedAt).getTime() -
        new Date(left.lastAddedAt).getTime()
      );
    })
    .slice(0, 30);
};

export const rankRecentProducts = ({
  products,
  usage,
  excludeProductIds,
  limit = 6,
}: {
  products: Product[];
  usage: RecentProductUsage[];
  excludeProductIds: Set<string>;
  limit?: number;
}) => {
  const productMap = new Map(products.map((product) => [String(product.id), product]));

  return usage
    .filter((entry) => !excludeProductIds.has(entry.productId))
    .map((entry) => ({
      entry,
      product: productMap.get(entry.productId),
    }))
    .filter(
      (
        item,
      ): item is {
        entry: RecentProductUsage;
        product: Product;
      } => Boolean(item.product),
    )
    .sort((left, right) => {
      if (right.entry.count !== left.entry.count) {
        return right.entry.count - left.entry.count;
      }

      return (
        new Date(right.entry.lastAddedAt).getTime() -
        new Date(left.entry.lastAddedAt).getTime()
      );
    })
    .slice(0, limit)
    .map((item) => item.product);
};

export const buildSmartSuggestions = ({
  products,
  invoices,
  currentCartProductIds,
  usage,
  limit = 6,
}: {
  products: Product[];
  invoices: Invoice[];
  currentCartProductIds: string[];
  usage: RecentProductUsage[];
  limit?: number;
}): SmartSuggestionProduct[] => {
  const productMap = new Map(products.map((product) => [String(product.id), product]));
  const excludeIds = new Set(currentCartProductIds);
  const usageMap = new Map(usage.map((entry) => [entry.productId, entry]));
  const cartIds = new Set(currentCartProductIds);
  const overallFrequency = new Map<string, number>();
  const pairFrequency = new Map<string, number>();

  invoices.forEach((invoice) => {
    if (invoice.status === "DRAFT" || invoice.status === "VOID") return;

    const invoiceProductIds = Array.from(
      new Set(
        invoice.items
          .map((item) => (item.product_id ? String(item.product_id) : ""))
          .filter(Boolean),
      ),
    );

    invoiceProductIds.forEach((productId) => {
      overallFrequency.set(productId, (overallFrequency.get(productId) ?? 0) + 1);
    });

    if (cartIds.size === 0) return;

    const hasCartMatch = invoiceProductIds.some((productId) => cartIds.has(productId));
    if (!hasCartMatch) return;

    invoiceProductIds.forEach((candidateId) => {
      if (cartIds.has(candidateId)) return;
      pairFrequency.set(candidateId, (pairFrequency.get(candidateId) ?? 0) + 1);
    });
  });

  const suggestions = products
    .filter((product) => !excludeIds.has(String(product.id)))
    .map((product) => {
      const productId = String(product.id);
      const pairCount = pairFrequency.get(productId) ?? 0;
      const overallCount = overallFrequency.get(productId) ?? 0;
      const recentCount = usageMap.get(productId)?.count ?? 0;
      const margin = clampMargin(product);
      const score =
        pairCount * 12 +
        overallCount * 3 +
        recentCount * 2 +
        margin * 8;

      const reasonLabel =
        pairCount >= 3
          ? "Popular combo"
          : pairCount > 0
            ? "Best match"
            : overallCount >= 3
              ? "Fast mover"
              : recentCount > 0
                ? "Quick access"
                : "Suggested";

      const reasonNote =
        pairCount >= 3
          ? "Frequently billed with your current cart"
          : pairCount > 0
            ? "Often added alongside this selection"
            : overallCount >= 3
              ? "Common in past invoices"
              : recentCount > 0
                ? "Used recently in billing"
                : "Helpful extra for faster billing";

      return {
        product,
        reasonLabel,
        reasonNote,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (suggestions.length >= limit) {
    return suggestions.slice(0, limit);
  }

  const fallback = products
    .filter((product) => !excludeIds.has(String(product.id)))
    .map((product) => {
      const productId = String(product.id);
      const overallCount = overallFrequency.get(productId) ?? 0;
      const recentCount = usageMap.get(productId)?.count ?? 0;
      const margin = clampMargin(product);

      return {
        product,
        reasonLabel: recentCount > 0 ? "Quick access" : "Fast mover",
        reasonNote:
          recentCount > 0
            ? "Used recently in billing"
            : "Popular in past invoices",
        score: overallCount * 3 + recentCount * 2 + margin * 8,
      };
    })
    .filter(
      (entry) =>
        entry.score > 0 &&
        !suggestions.some(
          (existing) => existing.product.id === entry.product.id,
        ),
    )
    .sort((left, right) => right.score - left.score);

  return [...suggestions, ...fallback].slice(0, limit);
};
