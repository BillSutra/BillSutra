"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InvoiceItemError, InvoiceItemForm } from "@/types/invoice";
import { useI18n } from "@/providers/LanguageProvider";

export type InvoiceTableProps = {
  items: InvoiceItemForm[];
  errors: InvoiceItemError[];
  products: Array<{
    id: number;
    name: string;
    sku: string;
    price: string;
    gst_rate: string;
  }>;
  onItemChange: (
    index: number,
    key: keyof InvoiceItemForm,
    value: string,
  ) => void;
  onProductSelect: (index: number, productId: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
};

const InvoiceTable = ({
  items,
  errors,
  products,
  onItemChange,
  onProductSelect,
  onAddItem,
  onRemoveItem,
}: InvoiceTableProps) => {
  const { t } = useI18n();

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
            {t("invoiceTable.lineItems")}
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            {t("invoiceTable.invoiceItems")}
          </h2>
        </div>
        <Button type="button" variant="outline" onClick={onAddItem}>
          {t("invoiceTable.addItem")}
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        {items.map((item, index) => {
          const availableProducts = products.filter((product) => {
            const productId = String(product.id);
            return (
              productId === item.product_id ||
              !items.some(
                (selectedItem, selectedIndex) =>
                  selectedIndex !== index &&
                  selectedItem.product_id === productId,
              )
            );
          });

          return (
            <div
              key={`item-${index}`}
              className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {t("invoiceTable.product")}
                </Label>
                <select
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
                  value={item.product_id}
                  onChange={(event) =>
                    onProductSelect(index, event.target.value)
                  }
                >
                  <option value="">{t("invoiceTable.selectProduct")}</option>
                  {availableProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.sku}
                    </option>
                  ))}
                </select>
                {errors[index]?.product_id && (
                  <p className="text-xs text-red-600 dark:text-red-300">
                    {errors[index]?.product_id}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    {t("invoiceTable.quantity")}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      onItemChange(index, "quantity", event.target.value)
                    }
                    className="h-10 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-indigo-500/20"
                  />
                  {errors[index]?.quantity && (
                    <p className="text-xs text-red-600 dark:text-red-300">
                      {errors[index]?.quantity}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    {t("invoiceTable.price")}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(event) =>
                      onItemChange(index, "price", event.target.value)
                    }
                    className="h-10 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-indigo-500/20"
                  />
                  {errors[index]?.price && (
                    <p className="text-xs text-red-600 dark:text-red-300">
                      {errors[index]?.price}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    {t("invoiceTable.gstRate")}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.tax_rate}
                    onChange={(event) =>
                      onItemChange(index, "tax_rate", event.target.value)
                    }
                    className="h-10 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-indigo-500/20"
                  />
                  {errors[index]?.tax_rate && (
                    <p className="text-xs text-red-600 dark:text-red-300">
                      {errors[index]?.tax_rate}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => onRemoveItem(index)}
                  disabled={items.length === 1}
                  className="h-10 w-full sm:w-auto"
                >
                  {t("invoiceTable.remove")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InvoiceTable;
