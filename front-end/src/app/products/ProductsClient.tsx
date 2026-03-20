"use client";

import React, { useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValidationField } from "@/components/ui/ValidationField";
import {
  useCategoriesQuery,
  useCreateCategoryMutation,
  useCreateProductMutation,
  useDeleteProductMutation,
  useProductsQuery,
  useUpdateProductMutation,
} from "@/hooks/useInventoryQueries";
import { useI18n } from "@/providers/LanguageProvider";

type ProductsClientProps = {
  name: string;
  image?: string;
};

const ProductsClient = ({ name, image }: ProductsClientProps) => {
  const { t, formatCurrency } = useI18n();
  const { data, isLoading, isError } = useProductsQuery();
  const { data: categories } = useCategoriesQuery();
  const createCategory = useCreateCategoryMutation();
  const createProduct = useCreateProductMutation();
  const updateProduct = useUpdateProductMutation();
  const deleteProduct = useDeleteProductMutation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    price: "",
    cost: "",
    gst_rate: "18",
    stock_on_hand: "0",
    reorder_level: "0",
    category_id: "",
  });
  const [editingForm, setEditingForm] = useState(form);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formTouched, setFormTouched] = useState(false);

  const isMutating =
    createCategory.isPending ||
    createProduct.isPending ||
    updateProduct.isPending ||
    deleteProduct.isPending;

  const products = useMemo(() => data ?? [], [data]);
  const categoryOptions = categories ?? [];

  const resetForm = () =>
    setForm({
      name: "",
      sku: "",
      barcode: "",
      price: "",
      cost: "",
      gst_rate: "18",
      stock_on_hand: "0",
      reorder_level: "0",
      category_id: "",
    });

  const toNumber = (value: string) => (value ? Number(value) : undefined);

  const validateProductNameField = (value: string) => {
    if (!value.trim()) return t("validation.required");
    if (
      !/^[\p{L}\p{N}\s\-&().,/'"]+$/u.test(value) ||
      value.trim().length < 2
    ) {
      return t("productsPage.validation.invalidName");
    }
    return "";
  };

  const validateRequiredField = (value: string) =>
    value.trim() ? "" : t("validation.required");

  const validateNumberField = (value: string) => {
    if (!value.trim()) return t("validation.required");
    if (!/^\d+(\.\d+)?$/.test(value)) return t("validation.validNumber");
    return "";
  };

  const validateAll = () => {
    return (
      !validateProductNameField(form.name) &&
      !validateRequiredField(form.sku) &&
      !validateNumberField(form.price) &&
      !validateNumberField(form.cost) &&
      !validateNumberField(form.gst_rate) &&
      !validateNumberField(form.stock_on_hand) &&
      !validateNumberField(form.reorder_level)
    );
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormTouched(true);
    if (!validateAll()) return;
    await createProduct.mutateAsync({
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      price: Number(form.price),
      cost: toNumber(form.cost),
      gst_rate: toNumber(form.gst_rate),
      stock_on_hand: toNumber(form.stock_on_hand),
      reorder_level: toNumber(form.reorder_level),
      category_id: form.category_id ? Number(form.category_id) : undefined,
    });
    resetForm();
    setFormTouched(false);
  };

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const created = await createCategory.mutateAsync({ name: trimmed });
    setNewCategoryName("");
    setForm((prev) => ({ ...prev, category_id: created.id.toString() }));
  };

  const handleEdit = (id: number) => {
    const current = products.find((product) => product.id === id);
    if (!current) return;
    setEditingId(id);
    setEditingForm({
      name: current.name ?? "",
      sku: current.sku ?? "",
      barcode: current.barcode ?? "",
      price: current.price ?? "",
      cost: current.cost ?? "",
      gst_rate: current.gst_rate ?? "18",
      stock_on_hand: current.stock_on_hand.toString(),
      reorder_level: current.reorder_level.toString(),
      category_id: current.category?.id?.toString() ?? "",
    });
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    await updateProduct.mutateAsync({
      id: editingId,
      payload: {
        name: editingForm.name.trim(),
        sku: editingForm.sku.trim(),
        barcode: editingForm.barcode.trim() || undefined,
        price: Number(editingForm.price),
        cost: toNumber(editingForm.cost),
        gst_rate: toNumber(editingForm.gst_rate),
        stock_on_hand: toNumber(editingForm.stock_on_hand),
        reorder_level: toNumber(editingForm.reorder_level),
        category_id: editingForm.category_id
          ? Number(editingForm.category_id)
          : undefined,
      },
    });
    setEditingId(null);
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("productsPage.title")}
      subtitle={t("productsPage.subtitle")}
    >
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="app-page-intro">
          <p className="app-kicker">{t("productsPage.kicker")}</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {t("productsPage.title")}
          </h1>
          <p className="app-lead">{t("productsPage.lead")}</p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="app-panel rounded-3xl p-6">
            <h2 className="text-lg font-semibold text-foreground">
              {t("productsPage.addTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("productsPage.addDescription")}
            </p>
            <form className="mt-5 grid gap-4" onSubmit={handleCreate} noValidate>
              <ValidationField
                id="name"
                label={t("productsPage.fields.name")}
                value={form.name}
                onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                validate={validateProductNameField}
                required
                placeholder={t("productsPage.placeholders.name")}
                success
              />
              <ValidationField
                id="sku"
                label={t("productsPage.fields.sku")}
                value={form.sku}
                onChange={(value) => setForm((prev) => ({ ...prev, sku: value }))}
                validate={validateRequiredField}
                required
                placeholder={t("productsPage.placeholders.sku")}
                success
              />
              <ValidationField
                id="barcode"
                label={t("productsPage.fields.barcode")}
                value={form.barcode}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, barcode: value }))
                }
                validate={() => ""}
                placeholder={t("productsPage.placeholders.barcode")}
                success
              />
              <ValidationField
                id="price"
                label={t("productsPage.fields.sellingPrice")}
                type="number"
                value={form.price}
                onChange={(value) => setForm((prev) => ({ ...prev, price: value }))}
                validate={validateNumberField}
                required
                placeholder={t("productsPage.placeholders.zero")}
                success
              />
              <ValidationField
                id="cost"
                label={t("productsPage.fields.costPrice")}
                type="number"
                value={form.cost}
                onChange={(value) => setForm((prev) => ({ ...prev, cost: value }))}
                validate={validateNumberField}
                placeholder={t("productsPage.placeholders.zero")}
                success
              />
              <ValidationField
                id="gst"
                label={t("productsPage.fields.gstRate")}
                type="number"
                value={form.gst_rate}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, gst_rate: value }))
                }
                validate={validateNumberField}
                placeholder={t("productsPage.placeholders.gstRate")}
                success
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <ValidationField
                  id="stock"
                  label={t("productsPage.fields.openingStock")}
                  type="number"
                  value={form.stock_on_hand}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, stock_on_hand: value }))
                  }
                  validate={validateNumberField}
                  placeholder={t("productsPage.placeholders.zero")}
                  success
                />
                <ValidationField
                  id="reorder"
                  label={t("productsPage.fields.reorderLevel")}
                  type="number"
                  value={form.reorder_level}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, reorder_level: value }))
                  }
                  validate={validateNumberField}
                  placeholder={t("productsPage.placeholders.zero")}
                  success
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category" className="text-foreground">
                  {t("productsPage.fields.category")}
                </Label>
                <select
                  id="category"
                  className="app-field h-10 px-3 text-sm text-foreground"
                  value={form.category_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, category_id: event.target.value }))
                  }
                >
                  <option value="">{t("productsPage.uncategorized")}</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="app-panel-muted rounded-2xl p-4">
                <Label htmlFor="new-category" className="text-foreground">
                  {t("productsPage.fields.newCategory")}
                </Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input
                    id="new-category"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder={t("productsPage.placeholders.categoryName")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreateCategory}
                    disabled={createCategory.isPending}
                  >
                    {createCategory.isPending
                      ? t("productsPage.actions.adding")
                      : t("productsPage.actions.addCategory")}
                  </Button>
                </div>
                {createCategory.isError && (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    {t("productsPage.createCategoryError")}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={isMutating || (formTouched && !validateAll())}
                aria-disabled={isMutating || (formTouched && !validateAll())}
              >
                {t("productsPage.actions.add")}
              </Button>
              {createProduct.isError && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t("productsPage.saveError")}
                </p>
              )}
            </form>
          </div>

          <div className="app-panel rounded-3xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("productsPage.listTitle")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("productsPage.listDescription")}
                </p>
              </div>
              {!isLoading && !isError && products.length > 0 ? (
                <span className="app-chip">
                  {t("productsPage.count", { count: products.length })}
                </span>
              ) : null}
            </div>
            <div className="mt-5">
              {isLoading && <div className="app-loading-skeleton h-64 w-full" />}
              {isError && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t("productsPage.loadError")}
                </p>
              )}
              {!isLoading && !isError && products.length === 0 && (
                <div className="app-empty-state text-sm">
                  {t("productsPage.empty")}
                </div>
              )}
              {!isLoading && !isError && products.length > 0 && (
                <div className="grid gap-3">
                  {products.map((product) => (
                    <div key={product.id} className="app-list-item px-4 py-4">
                      {editingId === product.id ? (
                        <form className="grid gap-3" onSubmit={handleUpdate}>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <Label>{t("productsPage.fields.name")}</Label>
                              <Input
                                value={editingForm.name}
                                onChange={(event) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    name: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("productsPage.fields.sku")}</Label>
                              <Input
                                value={editingForm.sku}
                                onChange={(event) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    sku: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("productsPage.fields.sellingPrice")}</Label>
                              <Input
                                type="number"
                                value={editingForm.price}
                                onChange={(event) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    price: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("productsPage.fields.openingStock")}</Label>
                              <Input
                                type="number"
                                value={editingForm.stock_on_hand}
                                onChange={(event) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    stock_on_hand: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("productsPage.fields.reorderLevel")}</Label>
                              <Input
                                type="number"
                                value={editingForm.reorder_level}
                                onChange={(event) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    reorder_level: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>{t("productsPage.fields.category")}</Label>
                              <select
                                className="app-field h-10 px-3 text-sm text-foreground"
                                value={editingForm.category_id}
                                onChange={(event) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    category_id: event.target.value,
                                  }))
                                }
                              >
                                <option value="">
                                  {t("productsPage.uncategorized")}
                                </option>
                                {categoryOptions.map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" disabled={isMutating}>
                              {t("productsPage.actions.save")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              {t("productsPage.actions.cancel")}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-foreground">
                                {product.name}
                              </p>
                              <span className="app-chip">{product.sku}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="app-chip">
                                {t("productsPage.categoryLabel", {
                                  name:
                                    product.category?.name ??
                                    t("productsPage.uncategorized"),
                                })}
                              </span>
                              <span className="app-chip">
                                {t("productsPage.stockLabel", {
                                  count: product.stock_on_hand,
                                })}
                              </span>
                              <span className="app-chip">
                                {t("productsPage.priceLabel", {
                                  amount: formatCurrency(Number(product.price)),
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleEdit(product.id)}
                            >
                              {t("productsPage.actions.edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => deleteProduct.mutate(product.id)}
                              disabled={deleteProduct.isPending}
                            >
                              {t("productsPage.actions.delete")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default ProductsClient;
