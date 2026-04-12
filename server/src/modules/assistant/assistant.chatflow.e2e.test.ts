import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../../config/db.config.js";
import { answerAssistantQuery } from "./assistant.service.js";

type ProductRecord = {
  id: number;
  name: string;
  price: number;
  gst_rate: number;
};

type ProductDelegateMock = {
  findMany: (
    ...args: unknown[]
  ) => Promise<
    Array<{ id: number; name: string; price: unknown; gst_rate: unknown }>
  >;
  findFirst: (...args: unknown[]) => Promise<{
    id: number;
    name: string;
    price: unknown;
    gst_rate: unknown;
  } | null>;
  create: (...args: unknown[]) => Promise<{
    id: number;
    name: string;
    price: unknown;
    gst_rate: unknown;
  }>;
  deleteMany: (...args: unknown[]) => Promise<{ count: number }>;
};

test("chatflow e2e keeps compact follow-ups and remove intents stable", async () => {
  const productDelegate = prisma.product as unknown as ProductDelegateMock;
  const originalFindMany = productDelegate.findMany;
  const originalFindFirst = productDelegate.findFirst;
  const originalCreate = productDelegate.create;
  const originalDeleteMany = productDelegate.deleteMany;

  const products: ProductRecord[] = [];
  let nextProductId = 1000;

  productDelegate.findMany = async (...args: unknown[]) => {
    const payload = (args[0] ?? {}) as {
      where?: {
        user_id?: number;
        name?: { contains?: string; mode?: string };
        OR?: Array<{ name?: { contains?: string; mode?: string } }>;
      };
      take?: number;
    };

    let results = [...products];

    const containsTerm = payload.where?.name?.contains;
    if (containsTerm) {
      const normalizedContains = String(containsTerm).toLowerCase();
      results = results.filter((product) =>
        product.name.toLowerCase().includes(normalizedContains),
      );
    }

    if (payload.where?.OR && payload.where.OR.length > 0) {
      results = results.filter((product) => {
        const normalizedName = product.name.toLowerCase();
        return payload.where?.OR?.some((clause) => {
          const term = clause.name?.contains;
          if (!term) {
            return false;
          }

          return normalizedName.includes(String(term).toLowerCase());
        });
      });
    }

    const take = payload.take ?? results.length;
    return results.slice(0, take).map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      gst_rate: product.gst_rate,
    }));
  };

  productDelegate.findFirst = async (...args: unknown[]) => {
    const payload = (args[0] ?? {}) as {
      where?: {
        user_id?: number;
        name?: { equals?: string; contains?: string; mode?: string };
      };
    };

    const equals = payload.where?.name?.equals;
    if (equals) {
      const normalizedEquals = String(equals).toLowerCase();
      const exactMatch = products.find(
        (product) => product.name.toLowerCase() === normalizedEquals,
      );
      if (exactMatch) {
        return {
          id: exactMatch.id,
          name: exactMatch.name,
          price: exactMatch.price,
          gst_rate: exactMatch.gst_rate,
        };
      }
    }

    const contains = payload.where?.name?.contains;
    if (contains) {
      const normalizedContains = String(contains).toLowerCase();
      const partialMatch = products.find((product) =>
        product.name.toLowerCase().includes(normalizedContains),
      );
      if (partialMatch) {
        return {
          id: partialMatch.id,
          name: partialMatch.name,
          price: partialMatch.price,
          gst_rate: partialMatch.gst_rate,
        };
      }
    }

    return null;
  };

  productDelegate.create = async (...args: unknown[]) => {
    const payload = (args[0] ?? {}) as {
      data?: { name?: string; price?: number; gst_rate?: number };
    };
    const created: ProductRecord = {
      id: nextProductId,
      name: payload.data?.name ?? "Unknown",
      price: payload.data?.price ?? 0,
      gst_rate: payload.data?.gst_rate ?? 0,
    };
    nextProductId += 1;
    products.push(created);

    return {
      id: created.id,
      name: created.name,
      price: created.price,
      gst_rate: created.gst_rate,
    };
  };

  productDelegate.deleteMany = async (...args: unknown[]) => {
    const payload = (args[0] ?? {}) as { where?: { id?: number } };
    const id = payload.where?.id;
    if (typeof id !== "number") {
      return { count: 0 };
    }

    const existingIndex = products.findIndex((product) => product.id === id);
    if (existingIndex < 0) {
      return { count: 0 };
    }

    products.splice(existingIndex, 1);
    return { count: 1 };
  };

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  const testUserId = 2;

  const ask = async (message: string) => {
    const reply = await answerAssistantQuery({
      userId: testUserId,
      message,
      history: [...history],
    });

    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: reply.answer });
    return reply;
  };

  try {
    const askName = await ask("Ek product add karo scale");
    assert.equal(askName.intent, "add_product");
    assert.equal(askName.action?.status, "failed");

    const askPrice = await ask("scale ka price Rs 200");
    assert.equal(askPrice.intent, "add_product");
    assert.equal(askPrice.action?.status, "failed");
    assert.match(askPrice.answer.toLowerCase(), /gst/);

    const askGstCompact = await ask("18%");
    assert.equal(askGstCompact.intent, "add_product");
    assert.equal(askGstCompact.action?.status, "success");
    assert.equal(askGstCompact.action?.resourceLabel, "Scale");
    assert.deepEqual(askGstCompact.structured.data, {
      productName: "Scale",
      price: 200,
      gst: 18,
    });

    const removeByPhrase = await ask("remove scale from products");
    assert.equal(removeByPhrase.intent, "remove_product");
    assert.equal(removeByPhrase.action?.status, "success");
    assert.equal(removeByPhrase.action?.resourceLabel, "Scale");

    const removeAgain = await ask("scale hata do");
    assert.equal(removeAgain.intent, "remove_product");
    assert.equal(removeAgain.action?.status, "failed");
    assert.match(removeAgain.answer.toLowerCase(), /nahi mila|could not find/);
  } finally {
    productDelegate.findMany = originalFindMany;
    productDelegate.findFirst = originalFindFirst;
    productDelegate.create = originalCreate;
    productDelegate.deleteMany = originalDeleteMany;
  }
});

test("chatflow e2e handles noisy GST follow-up phrase without product-name drift", async () => {
  const productDelegate = prisma.product as unknown as ProductDelegateMock;
  const originalFindMany = productDelegate.findMany;
  const originalFindFirst = productDelegate.findFirst;
  const originalCreate = productDelegate.create;
  const originalDeleteMany = productDelegate.deleteMany;

  const products: ProductRecord[] = [];
  let nextProductId = 2000;

  productDelegate.findMany = async (...args: unknown[]) => {
    const payload = (args[0] ?? {}) as {
      where?: {
        user_id?: number;
        name?: { contains?: string; mode?: string };
        OR?: Array<{ name?: { contains?: string; mode?: string } }>;
      };
      take?: number;
    };

    let results = [...products];

    const containsTerm = payload.where?.name?.contains;
    if (containsTerm) {
      const normalizedContains = String(containsTerm).toLowerCase();
      results = results.filter((product) =>
        product.name.toLowerCase().includes(normalizedContains),
      );
    }

    if (payload.where?.OR && payload.where.OR.length > 0) {
      results = results.filter((product) => {
        const normalizedName = product.name.toLowerCase();
        return payload.where?.OR?.some((clause) => {
          const term = clause.name?.contains;
          if (!term) {
            return false;
          }

          return normalizedName.includes(String(term).toLowerCase());
        });
      });
    }

    const take = payload.take ?? results.length;
    return results.slice(0, take).map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      gst_rate: product.gst_rate,
    }));
  };

  productDelegate.findFirst = async (...args: unknown[]) => {
    const payload = (args[0] ?? {}) as {
      where?: {
        user_id?: number;
        name?: { equals?: string; contains?: string; mode?: string };
      };
    };

    const equals = payload.where?.name?.equals;
    if (equals) {
      const normalizedEquals = String(equals).toLowerCase();
      const exactMatch = products.find(
        (product) => product.name.toLowerCase() === normalizedEquals,
      );
      if (exactMatch) {
        return {
          id: exactMatch.id,
          name: exactMatch.name,
          price: exactMatch.price,
          gst_rate: exactMatch.gst_rate,
        };
      }
    }

    const contains = payload.where?.name?.contains;
    if (contains) {
      const normalizedContains = String(contains).toLowerCase();
      const partialMatch = products.find((product) =>
        product.name.toLowerCase().includes(normalizedContains),
      );
      if (partialMatch) {
        return {
          id: partialMatch.id,
          name: partialMatch.name,
          price: partialMatch.price,
          gst_rate: partialMatch.gst_rate,
        };
      }
    }

    return null;
  };

  productDelegate.create = async (...args: unknown[]) => {
    const payload = (args[0] ?? {}) as {
      data?: { name?: string; price?: number; gst_rate?: number };
    };
    const created: ProductRecord = {
      id: nextProductId,
      name: payload.data?.name ?? "Unknown",
      price: payload.data?.price ?? 0,
      gst_rate: payload.data?.gst_rate ?? 0,
    };
    nextProductId += 1;
    products.push(created);

    return {
      id: created.id,
      name: created.name,
      price: created.price,
      gst_rate: created.gst_rate,
    };
  };

  productDelegate.deleteMany = async (...args: unknown[]) => {
    const payload = (args[0] ?? {}) as { where?: { id?: number } };
    const id = payload.where?.id;
    if (typeof id !== "number") {
      return { count: 0 };
    }

    const existingIndex = products.findIndex((product) => product.id === id);
    if (existingIndex < 0) {
      return { count: 0 };
    }

    products.splice(existingIndex, 1);
    return { count: 1 };
  };

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  const ask = async (message: string) => {
    const reply = await answerAssistantQuery({
      userId: 1,
      message,
      history: [...history],
    });

    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: reply.answer });
    return reply;
  };

  try {
    const askName = await ask("Ek product add karo scale");
    assert.equal(askName.intent, "add_product");
    assert.equal(askName.action?.status, "failed");

    const askPrice = await ask("scale ka price Rs 200");
    assert.equal(askPrice.intent, "add_product");
    assert.equal(askPrice.action?.status, "failed");
    assert.match(askPrice.answer.toLowerCase(), /gst/);

    const noisyGstReply = await ask("GST kar do bhaiya Rs 200");
    assert.equal(noisyGstReply.intent, "add_product");
    assert.equal(noisyGstReply.action?.status, "failed");
    assert.match(noisyGstReply.answer.toLowerCase(), /gst/);

    const compactGstReply = await ask("18%");
    assert.equal(compactGstReply.intent, "add_product");
    assert.equal(compactGstReply.action?.status, "success");
    assert.equal(compactGstReply.action?.resourceLabel, "Scale");
    assert.deepEqual(compactGstReply.structured.data, {
      productName: "Scale",
      price: 200,
      gst: 18,
    });

    const createdNames = products.map((product) => product.name.toLowerCase());
    assert.ok(createdNames.includes("scale"));
    assert.ok(!createdNames.includes("bhaiya"));
  } finally {
    productDelegate.findMany = originalFindMany;
    productDelegate.findFirst = originalFindFirst;
    productDelegate.create = originalCreate;
    productDelegate.deleteMany = originalDeleteMany;
  }
});
