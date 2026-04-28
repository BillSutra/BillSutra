import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";

export const productCategoryInclude = {
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductWithCategory = {
  category?: {
    id: number;
    name: string;
  } | null;
};

export const normalizeProductCategoryRecord = <T extends ProductWithCategory>(
  product: T,
) => {
  const categoryName = product.category?.name?.trim();

  if (!categoryName) {
    return {
      ...product,
      category: null,
    };
  }

  return {
    ...product,
    category: {
      ...product.category,
      name: categoryName,
    },
  };
};

export const normalizeProductCategoryRecords = <T extends ProductWithCategory>(
  products: T[],
) => products.map((product) => normalizeProductCategoryRecord(product));

export const clearDanglingProductCategoryReferences = async (userId: number) => {
  try {
    const updatedCount = await prisma.$executeRaw(Prisma.sql`
      UPDATE "products" AS p
      SET "category_id" = NULL
      WHERE p."user_id" = ${userId}
        AND p."category_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "categories" AS c
          WHERE c."id" = p."category_id"
            AND c."user_id" = p."user_id"
        )
    `);

    return Number(updatedCount) || 0;
  } catch (error) {
    console.warn("[products] unable to clear dangling category references", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
};
