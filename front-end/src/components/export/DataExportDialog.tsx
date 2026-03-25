"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/providers/LanguageProvider";
import {
  previewDataExport,
  runDataExport,
  type ExportFilters,
  type ExportFormat,
  type ExportPreviewResponse,
  type ExportRequest,
  type ExportResource,
  type ExportScope,
} from "@/lib/apiClient";

type ExportFieldOption = {
  id: string;
  label: string;
};

type DataExportDialogProps = {
  resource: ExportResource;
  title: string;
  triggerLabel?: string;
  selectedIds: number[];
  initialFilters?: ExportFilters;
  categoryOptions?: Array<{ id: number; name: string }>;
  disabled?: boolean;
};

const RESOURCE_FIELDS: Record<ExportResource, ExportFieldOption[]> = {
  products: [
    { id: "id", label: "Product ID" },
    { id: "name", label: "Product Name" },
    { id: "sku", label: "SKU" },
    { id: "barcode", label: "Barcode" },
    { id: "category", label: "Category" },
    { id: "price", label: "Selling Price" },
    { id: "cost", label: "Cost Price" },
    { id: "gst_rate", label: "GST Rate" },
    { id: "stock_on_hand", label: "Opening Stock" },
    { id: "reorder_level", label: "Reorder Level" },
    { id: "created_at", label: "Created At" },
    { id: "updated_at", label: "Updated At" },
  ],
  customers: [
    { id: "id", label: "Customer ID" },
    { id: "name", label: "Customer Name" },
    { id: "email", label: "Email" },
    { id: "phone", label: "Phone" },
    { id: "address", label: "Address" },
    { id: "invoice_count", label: "Invoice Count" },
    { id: "sale_count", label: "Sale Count" },
    { id: "created_at", label: "Created At" },
    { id: "updated_at", label: "Updated At" },
  ],
  invoices: [
    { id: "id", label: "Invoice ID" },
    { id: "invoice_number", label: "Invoice Number" },
    { id: "customer_name", label: "Customer Name" },
    { id: "customer_email", label: "Customer Email" },
    { id: "status", label: "Payment Status" },
    { id: "date", label: "Invoice Date" },
    { id: "due_date", label: "Due Date" },
    { id: "item_names", label: "Items" },
    { id: "item_count", label: "Item Count" },
    { id: "quantity_total", label: "Total Quantity" },
    { id: "subtotal", label: "Subtotal" },
    { id: "tax", label: "Tax" },
    { id: "discount", label: "Discount" },
    { id: "total", label: "Total" },
    { id: "paid_total", label: "Paid Amount" },
    { id: "balance_due", label: "Balance Due" },
    { id: "notes", label: "Notes" },
    { id: "created_at", label: "Created At" },
  ],
};

const PAYMENT_STATUS_OPTIONS = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
];

const downloadBlobFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const DataExportDialog = ({
  resource,
  title,
  triggerLabel = "Export",
  selectedIds,
  initialFilters,
  categoryOptions = [],
  disabled = false,
}: DataExportDialogProps) => {
  const { t, formatNumber } = useI18n();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [scope, setScope] = useState<ExportScope>(
    selectedIds.length > 0 ? "selected" : "all",
  );
  const [delivery, setDelivery] = useState<ExportRequest["delivery"]>("download");
  const [email, setEmail] = useState("");
  const [filters, setFilters] = useState<ExportFilters>(initialFilters ?? {});
  const [selectedFields, setSelectedFields] = useState<string[]>(
    RESOURCE_FIELDS[resource].map((field) => field.id),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<ExportPreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setFormat("xlsx");
    setScope(selectedIds.length > 0 ? "selected" : "all");
    setDelivery("download");
    setEmail("");
    setFilters(initialFilters ?? {});
    setSelectedFields(RESOURCE_FIELDS[resource].map((field) => field.id));
    setPreview(null);
    setPreviewError(null);
  }, [initialFilters, open, resource, selectedIds.length]);

  const fieldOptions = RESOURCE_FIELDS[resource];
  const selectedFieldOptions = useMemo(
    () =>
      selectedFields
        .map((fieldId) => fieldOptions.find((field) => field.id === fieldId))
        .filter((field): field is ExportFieldOption => Boolean(field)),
    [fieldOptions, selectedFields],
  );

  const localizedTitle =
    t(`exportDialog.resources.${resource}`) === `exportDialog.resources.${resource}`
      ? title
      : t(`exportDialog.resources.${resource}`);

  const getFieldLabel = (fieldId: string, fallback: string) => {
    const key = `exportDialog.fields.${fieldId}`;
    return t(key) === key ? fallback : t(key);
  };

  const getStatusLabel = (status: string) => {
    const key = `exportDialog.statuses.${status}`;
    return t(key) === key ? status.replaceAll("_", " ") : t(key);
  };

  const toggleField = (fieldId: string) => {
    setSelectedFields((prev) => {
      if (prev.includes(fieldId)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((value) => value !== fieldId);
      }

      return [...prev, fieldId];
    });
  };

  const moveField = (fieldId: string, direction: -1 | 1) => {
    setSelectedFields((prev) => {
      const index = prev.indexOf(fieldId);
      if (index < 0) return prev;

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }

      const copy = [...prev];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  };

  const handleExport = async () => {
    if (scope === "selected" && selectedIds.length === 0) {
      toast.error(t("exportDialog.selectedValidation"));
      return;
    }

    if (selectedFields.length === 0) {
      toast.error(t("exportDialog.fieldValidation"));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await runDataExport({
        resource,
        format,
        scope,
        delivery,
        email: delivery === "email" ? email.trim() || undefined : undefined,
        fields: selectedFields,
        selected_ids: scope === "selected" ? selectedIds : undefined,
        filters: scope === "filtered" ? filters : undefined,
      });

      if (result.delivery === "download") {
        downloadBlobFile(result.blob, result.fileName);
        toast.success(t("exportDialog.exportSuccess", { title: localizedTitle }));
      } else {
        toast.success(result.message);
      }

      setOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("exportDialog.exportError");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    if (scope === "selected" && selectedIds.length === 0) {
      setPreview(null);
      setPreviewError(t("exportDialog.previewSelectedValidation"));
      return;
    }

    if (selectedFields.length === 0) {
      setPreview(null);
      setPreviewError(t("exportDialog.previewFieldValidation"));
      return;
    }

    let isCancelled = false;
    setIsPreviewLoading(true);
    setPreviewError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await previewDataExport({
          resource,
          scope,
          fields: selectedFields,
          selected_ids: scope === "selected" ? selectedIds : undefined,
          filters: scope === "filtered" ? filters : undefined,
        });

        if (isCancelled) return;
        setPreview(result);
      } catch (error) {
        if (isCancelled) return;
        setPreview(null);
        setPreviewError(
          error instanceof Error ? error.message : t("exportDialog.previewError"),
        );
      } finally {
        if (!isCancelled) {
          setIsPreviewLoading(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [filters, open, resource, scope, selectedFields, selectedIds, t]);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
        {triggerLabel === "Export" ? t("exportDialog.export") : triggerLabel}
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t("exportDialog.title", { title: localizedTitle })}
        description={t("exportDialog.description")}
        contentClassName="w-[min(96vw,1100px)] max-w-[min(96vw,1100px)] max-h-[90vh] overflow-hidden"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleExport} disabled={isSubmitting}>
              {isSubmitting ? t("exportDialog.preparing") : t("exportDialog.exportNow")}
            </Button>
          </>
        }
      >
        <div className="grid max-h-[calc(90vh-140px)] gap-5 overflow-y-auto pr-1">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${resource}-export-format`}>{t("exportDialog.format")}</Label>
              <select
                id={`${resource}-export-format`}
                className="app-field h-10 px-3 text-sm text-foreground"
                value={format}
                onChange={(event) => setFormat(event.target.value as ExportFormat)}
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${resource}-export-delivery`}>{t("exportDialog.delivery")}</Label>
              <select
                id={`${resource}-export-delivery`}
                className="app-field h-10 px-3 text-sm text-foreground"
                value={delivery}
                onChange={(event) =>
                  setDelivery(event.target.value as ExportRequest["delivery"])
                }
              >
                <option value="download">{t("exportDialog.downloadNow")}</option>
                <option value="email">{t("exportDialog.emailFile")}</option>
              </select>
            </div>
          </div>

          {delivery === "email" ? (
            <div className="grid gap-2">
              <Label htmlFor={`${resource}-export-email`}>
                {t("exportDialog.destinationEmail")}
              </Label>
              <Input
                id={`${resource}-export-email`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </div>
          ) : null}

          <div className="grid gap-3">
            <Label>{t("exportDialog.scope")}</Label>
            <div className="grid gap-2 md:grid-cols-3">
              <button
                type="button"
                className={`rounded-xl border px-4 py-3 text-left text-sm ${scope === "all" ? "border-primary bg-primary/5" : "border-border/70"}`}
                onClick={() => setScope("all")}
              >
                <span className="block font-medium">{t("exportDialog.allData")}</span>
                <span className="text-muted-foreground">
                  {t("exportDialog.allDataDescription")}
                </span>
              </button>
              <button
                type="button"
                className={`rounded-xl border px-4 py-3 text-left text-sm ${scope === "filtered" ? "border-primary bg-primary/5" : "border-border/70"}`}
                onClick={() => setScope("filtered")}
              >
                <span className="block font-medium">{t("exportDialog.filteredData")}</span>
                <span className="text-muted-foreground">
                  {t("exportDialog.filteredDataDescription")}
                </span>
              </button>
              <button
                type="button"
                className={`rounded-xl border px-4 py-3 text-left text-sm ${scope === "selected" ? "border-primary bg-primary/5" : "border-border/70"} ${selectedIds.length === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                onClick={() => {
                  if (selectedIds.length > 0) setScope("selected");
                }}
              >
                <span className="block font-medium">{t("exportDialog.selectedOnly")}</span>
                <span className="text-muted-foreground">
                  {selectedIds.length > 0
                    ? t("exportDialog.selectedCount", {
                        count: formatNumber(selectedIds.length),
                      })
                    : t("exportDialog.selectedDisabled")}
                </span>
              </button>
            </div>
          </div>

          {scope === "filtered" ? (
            <div className="grid gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={`${resource}-start-date`}>{t("exportDialog.startDate")}</Label>
                  <Input
                    id={`${resource}-start-date`}
                    type="date"
                    value={filters.start_date ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        start_date: event.target.value || undefined,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${resource}-end-date`}>{t("exportDialog.endDate")}</Label>
                  <Input
                    id={`${resource}-end-date`}
                    type="date"
                    value={filters.end_date ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        end_date: event.target.value || undefined,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={`${resource}-search`}>
                    {resource === "products"
                      ? t("exportDialog.searchProduct")
                      : resource === "customers"
                        ? t("exportDialog.searchCustomer")
                        : t("exportDialog.searchInvoice")}
                  </Label>
                  <Input
                    id={`${resource}-search`}
                    value={filters.search ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        search: event.target.value || undefined,
                      }))
                    }
                    placeholder={
                      resource === "products"
                        ? t("exportDialog.productSearchPlaceholder")
                        : resource === "customers"
                          ? t("exportDialog.customerSearchPlaceholder")
                          : t("exportDialog.invoiceSearchPlaceholder")
                    }
                  />
                </div>

                {resource === "products" ? (
                  <div className="grid gap-2">
                    <Label htmlFor={`${resource}-category`}>{t("exportDialog.category")}</Label>
                    <select
                      id={`${resource}-category`}
                      className="app-field h-10 px-3 text-sm text-foreground"
                      value={filters.category ?? ""}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          category: event.target.value || undefined,
                        }))
                      }
                    >
                      <option value="">{t("exportDialog.allCategories")}</option>
                      {categoryOptions.map((category) => (
                        <option key={category.id} value={String(category.id)}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {resource === "invoices" ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor={`${resource}-customer-name`}>
                        {t("exportDialog.customerName")}
                      </Label>
                      <Input
                        id={`${resource}-customer-name`}
                        value={filters.customer_name ?? ""}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            customer_name: event.target.value || undefined,
                          }))
                        }
                        placeholder={t("exportDialog.customerName")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${resource}-payment-status`}>
                        {t("exportDialog.paymentStatus")}
                      </Label>
                      <select
                        id={`${resource}-payment-status`}
                        className="app-field h-10 px-3 text-sm text-foreground"
                        value={filters.payment_status ?? ""}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            payment_status: event.target.value || undefined,
                          }))
                        }
                      >
                        <option value="">{t("exportDialog.allStatuses")}</option>
                        {PAYMENT_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {getStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid min-h-0 gap-3 rounded-2xl border border-border/70 p-4">
              <div>
                <p className="text-sm font-medium">{t("exportDialog.fieldsToInclude")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("exportDialog.fieldsDescription")}
                </p>
              </div>
              <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                {fieldOptions.map((field) => (
                  <label
                    key={field.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.id)}
                      onChange={() => toggleField(field.id)}
                    />
                    <span className="min-w-0 flex-1 break-words leading-5">
                      {getFieldLabel(field.id, field.label)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid min-h-0 gap-3 rounded-2xl border border-border/70 p-4">
              <div>
                <p className="text-sm font-medium">{t("exportDialog.columnOrder")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("exportDialog.columnOrderDescription")}
                </p>
              </div>
              <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                {selectedFieldOptions.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid gap-3 rounded-xl border border-border/60 px-3 py-3 text-sm"
                  >
                    <span className="min-w-0 break-words text-sm font-medium leading-5">
                      {getFieldLabel(field.id, field.label)}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => moveField(field.id, -1)}
                        disabled={index === 0}
                      >
                        {t("exportDialog.moveUp")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => moveField(field.id, 1)}
                        disabled={index === selectedFieldOptions.length - 1}
                      >
                        {t("exportDialog.moveDown")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t("exportDialog.preview")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("exportDialog.previewDescription", {
                    count: formatNumber(preview?.previewCount ?? 0),
                  })}
                </p>
              </div>
              {preview ? (
                <span className="app-chip">
                  {t("exportDialog.previewCount", {
                    preview: formatNumber(preview.previewCount),
                    total: formatNumber(preview.totalCount),
                  })}
                </span>
              ) : null}
            </div>

            {isPreviewLoading ? (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                {t("exportDialog.loadingPreview")}
              </div>
            ) : previewError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {previewError}
              </div>
            ) : !preview || preview.rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                {t("exportDialog.noRecords")}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="min-w-[720px] text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      {preview.columns.map((column) => (
                        <th
                          key={column.id}
                          className="px-3 py-2 text-left font-medium whitespace-nowrap"
                        >
                          {getFieldLabel(column.id, column.label)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr
                        key={`preview-row-${rowIndex}`}
                        className="border-t border-border/70"
                      >
                        {row.map((value, columnIndex) => (
                          <td
                            key={`preview-cell-${rowIndex}-${columnIndex}`}
                            className="px-3 py-2 align-top text-foreground whitespace-nowrap"
                          >
                            {value || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DataExportDialog;
