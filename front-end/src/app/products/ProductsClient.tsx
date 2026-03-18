"use client";

import React, { useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValidationField } from "@/components/ui/ValidationField";
import {
  validateName,
  validateNumber,
  validateRequired,
} from "@/lib/validation";
import {
  useCategoriesQuery,
  useCreateCategoryMutation,
  useCreateProductMutation,
  useDeleteProductMutation,
  useProductsQuery,
  useUpdateProductMutation,
} from "@/hooks/useInventoryQueries";

type ProductsClientProps = {
  name: string;
  image?: string;
};

const ProductsClient = ({ name, image }: ProductsClientProps) => {
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

  const validateAll = () => {
    return (
      !validateName(form.name) &&
      !validateRequired(form.sku) &&
      !validateNumber(form.price) &&
      !validateNumber(form.cost, true) &&
      !validateNumber(form.gst_rate, true) &&
      !validateNumber(form.stock_on_hand, true) &&
      !validateNumber(form.reorder_level, true)
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
      title="Products"
      subtitle="Manage SKUs, pricing, and stock levels in one place."
    >
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="app-page-intro">
          <p className="app-kicker">Catalog</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Products
          </h1>
          <p className="app-lead">
            Add products, maintain stock thresholds, and keep pricing current
            without bouncing between screens.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="app-panel rounded-3xl p-6">
            <h2 className="text-lg font-semibold text-foreground">Add product</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create clean SKUs with category, pricing, and reorder details in
              one step.
            </p>
            <form className="mt-5 grid gap-4" onSubmit={handleCreate} noValidate>
              <ValidationField id="name" label="Product name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} validate={validateName} required placeholder="Product name" success />
              <ValidationField id="sku" label="SKU" value={form.sku} onChange={(value) => setForm((prev) => ({ ...prev, sku: value }))} validate={validateRequired} required placeholder="SKU" success />
              <ValidationField id="barcode" label="Barcode" value={form.barcode} onChange={(value) => setForm((prev) => ({ ...prev, barcode: value }))} validate={() => ""} placeholder="Barcode" success />
              <ValidationField id="price" label="Selling price" type="number" value={form.price} onChange={(value) => setForm((prev) => ({ ...prev, price: value }))} validate={validateNumber} required placeholder="0" success />
              <ValidationField id="cost" label="Cost price" type="number" value={form.cost} onChange={(value) => setForm((prev) => ({ ...prev, cost: value }))} validate={(v) => validateNumber(v, true)} placeholder="0" success />
              <ValidationField id="gst" label="GST rate" type="number" value={form.gst_rate} onChange={(value) => setForm((prev) => ({ ...prev, gst_rate: value }))} validate={(v) => validateNumber(v, true)} placeholder="18" success />
              <div className="grid gap-4 sm:grid-cols-2">
                <ValidationField id="stock" label="Opening stock" type="number" value={form.stock_on_hand} onChange={(value) => setForm((prev) => ({ ...prev, stock_on_hand: value }))} validate={(v) => validateNumber(v, true)} placeholder="0" success />
                <ValidationField id="reorder" label="Reorder level" type="number" value={form.reorder_level} onChange={(value) => setForm((prev) => ({ ...prev, reorder_level: value }))} validate={(v) => validateNumber(v, true)} placeholder="0" success />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category" className="text-foreground">Category</Label>
                <select id="category" className="app-field h-10 px-3 text-sm text-foreground" value={form.category_id} onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}>
                  <option value="">Uncategorized</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div className="app-panel-muted rounded-2xl p-4">
                <Label htmlFor="new-category" className="text-foreground">Add new category</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input id="new-category" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="e.g. Electronics" />
                  <Button type="button" variant="outline" onClick={handleCreateCategory} disabled={createCategory.isPending}>
                    {createCategory.isPending ? "Adding..." : "Add"}
                  </Button>
                </div>
                {createCategory.isError && (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Unable to create category.</p>
                )}
              </div>
              <Button type="submit" disabled={isMutating || (formTouched && !validateAll())} aria-disabled={isMutating || (formTouched && !validateAll())}>
                Add product
              </Button>
              {createProduct.isError && (
                <p className="text-sm text-amber-700 dark:text-amber-300">Unable to save product right now.</p>
              )}
            </form>
          </div>

          <div className="app-panel rounded-3xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Product list</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Update stock and pricing from a single, scan-friendly list.
                </p>
              </div>
              {!isLoading && !isError && products.length > 0 ? <span className="app-chip">{products.length} items</span> : null}
            </div>
            <div className="mt-5">
              {isLoading && <div className="app-loading-skeleton h-64 w-full" />}
              {isError && <p className="text-sm text-amber-700 dark:text-amber-300">Failed to load products.</p>}
              {!isLoading && !isError && products.length === 0 && <div className="app-empty-state text-sm">No products yet.</div>}
              {!isLoading && !isError && products.length > 0 && (
                <div className="grid gap-3">
                  {products.map((product) => (
                    <div key={product.id} className="app-list-item px-4 py-4">
                      {editingId === product.id ? (
                        <form className="grid gap-3" onSubmit={handleUpdate}>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-2"><Label>Name</Label><Input value={editingForm.name} onChange={(event) => setEditingForm((prev) => ({ ...prev, name: event.target.value }))} required /></div>
                            <div className="grid gap-2"><Label>SKU</Label><Input value={editingForm.sku} onChange={(event) => setEditingForm((prev) => ({ ...prev, sku: event.target.value }))} required /></div>
                            <div className="grid gap-2"><Label>Price</Label><Input type="number" value={editingForm.price} onChange={(event) => setEditingForm((prev) => ({ ...prev, price: event.target.value }))} required /></div>
                            <div className="grid gap-2"><Label>Stock</Label><Input type="number" value={editingForm.stock_on_hand} onChange={(event) => setEditingForm((prev) => ({ ...prev, stock_on_hand: event.target.value }))} /></div>
                            <div className="grid gap-2"><Label>Reorder level</Label><Input type="number" value={editingForm.reorder_level} onChange={(event) => setEditingForm((prev) => ({ ...prev, reorder_level: event.target.value }))} /></div>
                            <div className="grid gap-2">
                              <Label>Category</Label>
                              <select className="app-field h-10 px-3 text-sm text-foreground" value={editingForm.category_id} onChange={(event) => setEditingForm((prev) => ({ ...prev, category_id: event.target.value }))}>
                                <option value="">Uncategorized</option>
                                {categoryOptions.map((category) => (
                                  <option key={category.id} value={category.id}>{category.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" disabled={isMutating}>Save</Button>
                            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-foreground">{product.name}</p>
                              <span className="app-chip">{product.sku}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="app-chip">Category: {product.category?.name ?? "Uncategorized"}</span>
                              <span className="app-chip">Stock: {product.stock_on_hand}</span>
                              <span className="app-chip">Price: Rs {Number(product.price).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" onClick={() => handleEdit(product.id)}>Edit</Button>
                            <Button type="button" variant="destructive" onClick={() => deleteProduct.mutate(product.id)} disabled={deleteProduct.isPending}>Delete</Button>
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
