import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../../config/db.config.js";
import { answerAssistantQuery } from "./assistant.service.js";

type CustomerDelegateMock = {
  findFirst: (
    ...args: unknown[]
  ) => Promise<{ id: number; name: string } | null>;
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

test("returns exact billing-only fallback for out-of-scope prompts", async () => {
  const reply = await answerAssistantQuery({
    userId: 1,
    message: "Mujhe savings aur budgeting tips do",
  });

  assert.equal(reply.intent, "help");
  assert.equal(
    reply.answer,
    "Main sirf billing aur products mein help kar sakta hoon.",
  );
  assert.equal(reply.command?.intent, "OUT_OF_SCOPE");
  assert.deepEqual(reply.structured, {
    intent: "OUT_OF_SCOPE",
    data: {},
    action: "NONE",
    message: "Main sirf billing aur products mein help kar sakta hoon.",
    target: undefined,
  });
});

test("returns exact fallback for sales queries outside strict domain", async () => {
  const reply = await answerAssistantQuery({
    userId: 1,
    message: "aaj ki sales data dikhao",
  });

  assert.equal(reply.intent, "help");
  assert.equal(
    reply.answer,
    "Main sirf billing aur products mein help kar sakta hoon.",
  );
  assert.equal(reply.command?.intent, "OUT_OF_SCOPE");
  assert.deepEqual(reply.structured, {
    intent: "OUT_OF_SCOPE",
    data: {},
    action: "NONE",
    message: "Main sirf billing aur products mein help kar sakta hoon.",
    target: undefined,
  });
});

test("create bill returns required command payload and simple-bill route", async () => {
  const customerDelegate = prisma.customer as unknown as CustomerDelegateMock;
  const originalFindFirst = customerDelegate.findFirst;

  customerDelegate.findFirst = async () => null;

  try {
    const reply = await answerAssistantQuery({
      userId: 1,
      message: "create a bill for Dhruv Thakur",
    });

    assert.equal(reply.intent, "create_bill");
    assert.equal(reply.answer, "Dhruv Thakur ke liye bill bana raha hoon...");
    assert.deepEqual(reply.command, {
      intent: "CREATE_BILL",
      customerName: "Dhruv Thakur",
    });
    assert.equal(reply.action?.type, "open_simple_bill");
    assert.equal(reply.action?.status, "success");
    assert.equal(
      reply.action?.route,
      "/dashboard/simple-bill?new=1&customer=Dhruv%20Thakur",
    );
    assert.deepEqual(reply.structured, {
      intent: "CREATE_BILL",
      data: {
        customerName: "Dhruv Thakur",
      },
      action: "NAVIGATE",
      target: "/dashboard/simple-bill?new=1&customer=Dhruv%20Thakur",
      message: "Dhruv Thakur ke liye bill bana raha hoon...",
    });
  } finally {
    customerDelegate.findFirst = originalFindFirst;
  }
});

test("show products returns show_products action with route", async () => {
  const reply = await answerAssistantQuery({
    userId: 1,
    message: "products dikhao",
  });

  assert.equal(reply.intent, "show_products");
  assert.equal(reply.action?.type, "show_products");
  assert.equal(reply.action?.route, "/dashboard/products");
  assert.equal(reply.command?.intent, "SHOW_PRODUCTS");
  assert.equal(reply.structured.intent, "SHOW_PRODUCTS");
  assert.equal(reply.structured.action, "NAVIGATE");
  assert.equal(reply.structured.target, "/dashboard/products");
  assert.equal(reply.structured.message, reply.answer);
});

test("navigate intent opens requested page with structured target", async () => {
  const reply = await answerAssistantQuery({
    userId: 1,
    message: "customers page kholo",
  });

  assert.equal(reply.intent, "navigate");
  assert.equal(reply.action?.type, "navigate");
  assert.equal(reply.action?.route, "/dashboard/customers");
  assert.equal(reply.command?.intent, "NAVIGATE");
  assert.equal(reply.structured.intent, "NAVIGATE");
  assert.equal(reply.structured.action, "NAVIGATE");
  assert.equal(reply.structured.target, "/dashboard/customers");
  assert.equal(reply.structured.message, reply.answer);
  assert.deepEqual(reply.structured.data, {
    target: "/dashboard/customers",
  });
});

test("add-product follow-up maps compact GST reply using recent context", async () => {
  const productDelegate = prisma.product as unknown as ProductDelegateMock;
  const originalFindMany = productDelegate.findMany;
  const originalFindFirst = productDelegate.findFirst;
  const originalCreate = productDelegate.create;

  productDelegate.findMany = async () => [];
  productDelegate.findFirst = async () => null;
  productDelegate.create = async (...args: unknown[]) => {
    const payload = args[0] as {
      data?: { name?: string; price?: number; gst_rate?: number };
    };

    return {
      id: 901,
      name: payload.data?.name ?? "Scale",
      price: payload.data?.price ?? 200,
      gst_rate: payload.data?.gst_rate ?? 18,
    };
  };

  try {
    const reply = await answerAssistantQuery({
      userId: 1,
      message: "18",
      history: [
        { role: "user", content: "Ek product add karo scale" },
        { role: "assistant", content: "Scale ka price bata do (₹ mein)." },
        { role: "user", content: "scale ka price Rs 200" },
        {
          role: "assistant",
          content: "Scale ₹200 noted. GST kitna apply karna hai?",
        },
      ],
    });

    assert.equal(reply.intent, "add_product");
    assert.equal(reply.command?.intent, "ADD_PRODUCT");
    assert.equal(reply.structured.intent, "ADD_PRODUCT");
    assert.equal(reply.structured.action, "ADD_PRODUCT");
    assert.deepEqual(reply.structured.data, {
      productName: "Scale",
      price: 200,
      gst: 18,
    });
  } finally {
    productDelegate.findMany = originalFindMany;
    productDelegate.findFirst = originalFindFirst;
    productDelegate.create = originalCreate;
  }
});

test("remove-product uses current message and does not leak previous user text", async () => {
  const productDelegate = prisma.product as unknown as ProductDelegateMock;
  const originalFindMany = productDelegate.findMany;
  const originalFindFirst = productDelegate.findFirst;
  const originalDeleteMany = productDelegate.deleteMany;

  productDelegate.findMany = async () => [];
  productDelegate.findFirst = async (...args: unknown[]) => {
    const payload = args[0] as {
      where?: { name?: { equals?: string; mode?: string } };
    };
    const equals = payload.where?.name?.equals?.toLowerCase().trim();

    if (equals === "bhaiya") {
      return {
        id: 77,
        name: "Bhaiya",
        price: 200,
        gst_rate: 18,
      };
    }

    return null;
  };
  productDelegate.deleteMany = async () => ({ count: 1 });

  try {
    const reply = await answerAssistantQuery({
      userId: 1,
      message: "bhaiya hata do",
      history: [
        { role: "user", content: "remove bhaiya as a product" },
        {
          role: "assistant",
          content:
            'Mujhe "bhaiya" nahi mila. Kya aap "Bhaiya" kehna chah rahe the?',
        },
      ],
    });

    assert.equal(reply.intent, "remove_product");
    assert.equal(reply.action?.type, "remove_product");
    assert.equal(reply.action?.status, "success");
    assert.equal(reply.action?.resourceLabel, "Bhaiya");
    assert.equal(reply.structured.intent, "REMOVE_PRODUCT");
    assert.deepEqual(reply.structured.data, {
      productName: "bhaiya",
    });
  } finally {
    productDelegate.findMany = originalFindMany;
    productDelegate.findFirst = originalFindFirst;
    productDelegate.deleteMany = originalDeleteMany;
  }
});
