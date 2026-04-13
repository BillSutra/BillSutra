import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCreateBillMessage,
  parseAddProductMessage,
  parseRemoveProductMessage,
} from "./assistant.service.js";

type CreateBillCase = {
  input: string;
  expected: {
    customerName: string | null;
  };
};

type AddCase = {
  input: string;
  expected: {
    productName: string | null;
    price: number | null;
    gst: number | null;
  };
};

type RemoveCase = {
  input: string;
  expected: {
    productName: string | null;
    hasRemoveKeyword: boolean;
  };
};

const createBillCases: CreateBillCase[] = [
  {
    input: "create a bill for Dhruv Thakur",
    expected: { customerName: "Dhruv Thakur" },
  },
  {
    input: "Dhruv ke liye bill bana",
    expected: { customerName: "Dhruv" },
  },
  {
    input: "make invoice for Dhruv",
    expected: { customerName: "Dhruv" },
  },
  {
    input: "Dhruv ka bill generate karo",
    expected: { customerName: "Dhruv" },
  },
  {
    input: 'Create bill for "Ravi Kumar"',
    expected: { customerName: "Ravi Kumar" },
  },
];

const addCases: AddCase[] = [
  {
    input: "Add a product bluetooth speaker worth Rs 2000 with GST of 5%",
    expected: { productName: "Bluetooth Speaker", price: 2000, gst: 5 },
  },
  {
    input: "Add speaker at 2000 with GST 5",
    expected: { productName: "Speaker", price: 2000, gst: 5 },
  },
  {
    input: "Create item speaker price 2000 GST 5",
    expected: { productName: "Speaker", price: 2000, gst: 5 },
  },
  {
    input: "Add product speaker 2000 rs gst 5",
    expected: { productName: "Speaker", price: 2000, gst: 5 },
  },
  {
    input: "speaker add karo 2000 ka gst 5",
    expected: { productName: "Speaker", price: 2000, gst: 5 },
  },
  {
    input: "bluetooth speaker 2000 ka daal do gst 5 ke saath",
    expected: { productName: "Bluetooth Speaker", price: 2000, gst: 5 },
  },
  {
    input: "ek product add karo speaker naam ka 2000 price gst 5",
    expected: { productName: "Speaker", price: 2000, gst: 5 },
  },
  {
    input: "add speaker 2000 gst 5",
    expected: { productName: "Speaker", price: 2000, gst: 5 },
  },
  {
    input: "speaker 2000 5% gst",
    expected: { productName: "Speaker", price: 2000, gst: 5 },
  },
  {
    input: "add speaker 2000",
    expected: { productName: "Speaker", price: 2000, gst: null },
  },
  {
    input:
      "Ek mouse naam ka product add karo jismein uska price 2000 hai aur gst 5 hai",
    expected: { productName: "Mouse", price: 2000, gst: 5 },
  },
  {
    input: 'Add product "दूध" price 60 GST 5',
    expected: { productName: "दूध", price: 60, gst: 5 },
  },
  {
    input: 'Add product "चावल" worth Rs 1,200 with GST 5',
    expected: { productName: "चावल", price: 1200, gst: 5 },
  },
  {
    input: "mouse add karo ₹2,500 GST 5",
    expected: { productName: "Mouse", price: 2500, gst: 5 },
  },
  {
    input: 'Please add product "pen" at 12.5 GST 18',
    expected: { productName: "Pen", price: 12.5, gst: 18 },
  },
  {
    input: "add karo product biscuit ka price 20 aur GST 0",
    expected: { productName: "Biscuit", price: 20, gst: 0 },
  },
  {
    input: "18%",
    expected: { productName: null, price: null, gst: 18 },
  },
  {
    input: "bhaiya Ek product ke naam ka Jiska price 200 aur usmein GST 18 hai",
    expected: { productName: null, price: 200, gst: 18 },
  },
];

const removeCases: RemoveCase[] = [
  {
    input: "Remove speaker",
    expected: { productName: "speaker", hasRemoveKeyword: true },
  },
  {
    input: "Delete bluetooth speaker",
    expected: { productName: "bluetooth speaker", hasRemoveKeyword: true },
  },
  {
    input: "Remove product speaker",
    expected: { productName: "speaker", hasRemoveKeyword: true },
  },
  {
    input: "Delete item speaker",
    expected: { productName: "speaker", hasRemoveKeyword: true },
  },
  {
    input: "speaker hata do",
    expected: { productName: "speaker", hasRemoveKeyword: true },
  },
  {
    input: "speaker delete karo",
    expected: { productName: "speaker", hasRemoveKeyword: true },
  },
  {
    input: "bluetooth speaker hatao",
    expected: { productName: "bluetooth speaker", hasRemoveKeyword: true },
  },
  {
    input: "ye product remove karo speaker",
    expected: { productName: "speaker", hasRemoveKeyword: true },
  },
  {
    input: "remove speaker",
    expected: { productName: "speaker", hasRemoveKeyword: true },
  },
  {
    input: "speaker hatao",
    expected: { productName: "speaker", hasRemoveKeyword: true },
  },
  {
    input: "remove",
    expected: { productName: null, hasRemoveKeyword: true },
  },
  {
    input: "delete item",
    expected: { productName: null, hasRemoveKeyword: true },
  },
  {
    input: "remove bhaiya as a product",
    expected: { productName: "bhaiya", hasRemoveKeyword: true },
  },
];

test("parseAddProductMessage handles natural language add-product variations", async (t) => {
  for (const scenario of addCases) {
    await t.test(scenario.input, () => {
      const parsed = parseAddProductMessage(scenario.input);

      assert.equal(parsed.intent, "ADD_PRODUCT");
      assert.equal(parsed.productName, scenario.expected.productName);
      assert.equal(parsed.price, scenario.expected.price);
      assert.equal(parsed.gst, scenario.expected.gst);
    });
  }
});

test("parseRemoveProductMessage handles natural language remove-product variations", async (t) => {
  for (const scenario of removeCases) {
    await t.test(scenario.input, () => {
      const parsed = parseRemoveProductMessage(scenario.input);

      assert.equal(parsed.intent, "REMOVE_PRODUCT");
      assert.equal(parsed.productName, scenario.expected.productName);
      assert.equal(parsed.hasRemoveKeyword, scenario.expected.hasRemoveKeyword);
    });
  }
});

test("parseCreateBillMessage extracts customer name across billing phrases", async (t) => {
  for (const scenario of createBillCases) {
    await t.test(scenario.input, () => {
      const parsed = parseCreateBillMessage(scenario.input);

      assert.equal(parsed.intent, "CREATE_BILL");
      assert.equal(parsed.customerName, scenario.expected.customerName);
    });
  }
});
