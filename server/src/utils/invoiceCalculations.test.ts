import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateInvoiceTotals,
  getAppliedDiscountAmount,
  getDiscountValidationMessage,
} from "../../../shared/invoice-calculations.ts";

test("fixed discount is capped by subtotal and total stays rounded", () => {
  const totals = calculateInvoiceTotals({
    items: [
      { name: "Notebook", quantity: 2, price: 499.99, tax_rate: 18 },
      { name: "Pen", quantity: 3, price: 19.5, tax_rate: 18 },
    ],
    discountValue: 2000,
    discountType: "FIXED",
    taxMode: "CGST_SGST",
  });

  assert.equal(totals.subtotal, 1058.48);
  assert.equal(totals.discount, 1058.48);
  assert.equal(totals.tax, 190.53);
  assert.equal(totals.total, 190.53);
  assert.equal(totals.cgst + totals.sgst, totals.tax);
});

test("percentage discount is applied on subtotal only", () => {
  const totals = calculateInvoiceTotals({
    items: [{ name: "Service", quantity: 1, price: 1000, tax_rate: 18 }],
    discountValue: 10,
    discountType: "PERCENTAGE",
    taxMode: "IGST",
  });

  assert.equal(totals.discount, 100);
  assert.equal(totals.tax, 180);
  assert.equal(totals.igst, 180);
  assert.equal(totals.total, 1080);
});

test("floating-point inputs stay currency-safe", () => {
  const totals = calculateInvoiceTotals({
    items: [
      { name: "Tea", quantity: 3, price: 0.1, tax_rate: 5 },
      { name: "Snack", quantity: 1, price: 0.2, tax_rate: 5 },
    ],
    discountValue: 0.1,
    discountType: "FIXED",
    taxMode: "CGST_SGST",
  });

  assert.equal(totals.subtotal, 0.5);
  assert.equal(totals.tax, 0.03);
  assert.equal(totals.discount, 0.1);
  assert.equal(totals.total, 0.43);
});

test("discount helpers enforce percentage and subtotal limits", () => {
  assert.equal(
    getDiscountValidationMessage({
      subtotal: 1000,
      discountValue: 150,
      discountType: "PERCENTAGE",
    }),
    "Discount percentage cannot exceed 100%.",
  );

  assert.equal(
    getDiscountValidationMessage({
      subtotal: 1000,
      discountValue: 1500,
      discountType: "FIXED",
    }),
    "Discount cannot exceed subtotal.",
  );

  assert.equal(
    getAppliedDiscountAmount({
      subtotal: 1000,
      discountValue: 15,
      discountType: "PERCENTAGE",
    }),
    150,
  );
});
