"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PackagePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import BeginnerGuideCard from "@/components/beginner/BeginnerGuideCard";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DataExportDialog from "@/components/export/DataExportDialog";
import FriendlyEmptyState from "@/components/ui/FriendlyEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValidationField } from "@/components/ui/ValidationField";
import {
  useCategoriesQuery,
  useCreateCategoryMutation,
  useCreateProductMutation,
  useDeleteProductMutation,
  useProductsPageQuery,
  useUpdateProductMutation,
} from "@/hooks/useInventoryQueries";
import {
  confirmProductImport,
  downloadProductImportTemplate,
  previewProductImport,
  type ProductImportPreview,
} from "@/lib/apiClient";
import { invalidateDashboardQueries } from "@/lib/dashboardRealtime";
import { useI18n } from "@/providers/LanguageProvider";

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const PRODUCTS_PAGE_LIMIT = 20;

type ProductsClientProps = {
  name: string;
  image?: string;
  canManageProducts: boolean;
};

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

const toSafeCsvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

export default function ProductsClient({
  name,
  image,
  canManageProducts,
}: ProductsClientProps) {
  const { language, t, formatCurrency } = useI18n();
  const queryClient = useQueryClient();
  const { data: categories } = useCategoriesQuery();
  const createCategory = useCreateCategoryMutation();
  const createProduct = useCreateProductMutation();
  const updateProduct = useUpdateProductMutation();
  const deleteProduct = useDeleteProductMutation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ProductImportPreview | null>(
    null,
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    importedCount: number;
    skippedCount: number;
  } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  const { data, isLoading, isError, isFetching } = useProductsPageQuery({
    page: currentPage,
    limit: PRODUCTS_PAGE_LIMIT,
    category: selectedCategoryFilter || null,
    search: debouncedSearch || null,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategoryFilter]);

  useEffect(() => {
    if (data?.totalPages && currentPage > data.totalPages) {
      setCurrentPage(data.totalPages);
    }
  }, [currentPage, data?.totalPages]);

  const products = useMemo(() => data?.products ?? [], [data]);
  const categoryOptions = categories ?? [];
  const totalProducts = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const showingFrom = totalProducts === 0 ? 0 : (currentPage - 1) * PRODUCTS_PAGE_LIMIT + 1;
  const showingTo = Math.min(currentPage * PRODUCTS_PAGE_LIMIT, totalProducts);

  const isMutating =
    createCategory.isPending ||
    createProduct.isPending ||
    updateProduct.isPending ||
    deleteProduct.isPending;

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

  const resetImportState = () => {
    setSelectedImportFile(null);
    setImportPreview(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
  const validateOptionalNumberField = (value: string) => {
    if (!value.trim()) return "";
    if (!/^\d+(\.\d+)?$/.test(value)) return t("validation.validNumber");
    return "";
  };
  const validateAll = () =>
    !validateProductNameField(form.name) &&
    !validateRequiredField(form.sku) &&
    !validateNumberField(form.price) &&
    !validateOptionalNumberField(form.cost) &&
    !validateNumberField(form.gst_rate) &&
    !validateNumberField(form.stock_on_hand) &&
    !validateNumberField(form.reorder_level);

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

  const toggleProductSelection = (productId: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  };

  const handleImportFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    setImportSummary(null);
    setImportPreview(null);
    setUploadProgress(0);
    if (!file) {
      setSelectedImportFile(null);
      return;
    }
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setSelectedImportFile(null);
      toast.error("Only .xlsx and .csv files are supported.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      setSelectedImportFile(null);
      toast.error("File exceeds the 5MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedImportFile(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      const { blob, fileName } = await downloadProductImportTemplate();
      downloadBlobFile(blob, fileName);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to download the product import template.";
      toast.error(message);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handlePreviewImport = async () => {
    if (!selectedImportFile) {
      toast.error("Choose a file before generating a preview.");
      return;
    }
    try {
      setIsPreviewingImport(true);
      setImportSummary(null);
      const preview = await previewProductImport(selectedImportFile, {
        onUploadProgress: setUploadProgress,
      });
      setImportPreview(preview);
      toast.success("Validation complete.", {
        description: `${preview.summary.validRows} valid rows, ${preview.summary.invalidRows} rows with errors.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to validate the uploaded file.";
      toast.error(message);
    } finally {
      setIsPreviewingImport(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    try {
      setIsConfirmingImport(true);
      const result = await confirmProductImport(importPreview.previewToken);
      setImportSummary({
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        invalidateDashboardQueries(queryClient),
      ]);
      resetImportState();
      toast.success("Bulk import finished.", {
        description: `${result.importedCount} products imported, ${result.skippedCount} rows skipped.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to confirm import.";
      toast.error(message);
    } finally {
      setIsConfirmingImport(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!importPreview || importPreview.invalidRows.length === 0) return;
    const csv = [
      [
        "row_number",
        "name",
        "sku",
        "barcode",
        "selling_price",
        "cost_price",
        "gst_rate",
        "opening_stock",
        "reorder_level",
        "category",
        "errors",
      ],
      ...importPreview.invalidRows.map((row) => [
        row.rowNumber,
        toSafeCsvCell(row.values.name),
        toSafeCsvCell(row.values.sku),
        toSafeCsvCell(row.values.barcode),
        toSafeCsvCell(row.values.sellingPrice),
        toSafeCsvCell(row.values.costPrice),
        toSafeCsvCell(row.values.gstRate),
        toSafeCsvCell(row.values.openingStock),
        toSafeCsvCell(row.values.reorderLevel),
        toSafeCsvCell(row.values.category),
        toSafeCsvCell(row.errors.join(" | ")),
      ]),
    ]
      .map((cells) =>
        cells.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    downloadBlobFile(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      "product-import-errors.csv",
    );
  };

  const scrollToCreateForm = () => {
    document.getElementById("product-create-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const emptyStateCopy =
    language === "hi"
      ? {
          title: "अभी कोई प्रोडक्ट नहीं है",
          description: "अपना पहला प्रोडक्ट जोड़ें ताकि आप तुरंत बिल बनाना शुरू कर सकें।",
          hint: "शुरुआत के लिए सिर्फ प्रोडक्ट नाम और बिक्री कीमत काफी है।",
          primary: "प्रोडक्ट जोड़ें",
          secondary: "बिल बनाएं",
        }
      : language === "hinglish"
        ? {
            title: "Abhi koi product nahi hai",
            description: "Apna pehla product jodiye taki aap turant bill banana shuru kar saken.",
            hint: "Shuruaat ke liye sirf product naam aur selling price kaafi hai.",
            primary: "Product Jodiye",
            secondary: "Bill Banaiye",
          }
        : {
            title: "No products yet",
            description: "Add your first product so you can start making bills right away.",
            hint: "Start by adding one item you sell. Product name and selling price are enough to begin.",
            primary: "Add Product",
            secondary: "Create Bill",
          };
  const showBeginnerGuide =
    !isLoading &&
    !isError &&
    totalProducts === 0 &&
    !debouncedSearch &&
    !selectedCategoryFilter;
  const beginnerGuideCopy =
    language === "hi"
      ? {
          kicker: "स्टेप 2",
          title: "अब अपना पहला प्रोडक्ट जोड़ें",
          description:
            "शुरुआत के लिए सिर्फ प्रोडक्ट का नाम और बिक्री कीमत भरें। SKU, बारकोड और bulk import बाद में भी कर सकते हैं।",
          progressLabel: "अभी यही सबसे जरूरी काम है",
          steps: [
            {
              title: "दुकान की जानकारी",
              description: "अगर अभी नहीं भरी है तो पहले दुकान का नाम और फोन जोड़ें।",
              href: "/business-profile",
              actionLabel: "दुकान सेट करें",
            },
            {
              title: "पहला प्रोडक्ट जोड़ें",
              description: "नाम और कीमत भरते ही आप बिल बनाना शुरू कर सकते हैं।",
              active: true,
            },
            {
              title: "फिर ग्राहक जोड़ें",
              description: "ग्राहक का नाम और फोन बाद वाले स्टेप में जोड़ें।",
              href: "/customers",
              actionLabel: "ग्राहक पेज खोलें",
            },
            {
              title: "फिर बिल बनाएं",
              description: "जब प्रोडक्ट तैयार हो जाए तो सीधा बिल स्क्रीन खोलें।",
              href: "/simple-bill",
              actionLabel: "बिल स्क्रीन खोलें",
            },
          ],
          primary: "फॉर्म तक जाएं",
          secondary: "सीधा बिल पेज खोलें",
        }
      : language === "hinglish"
        ? {
            kicker: "Step 2",
            title: "Ab apna pehla product jodiye",
            description:
              "Shuruaat ke liye sirf product ka naam aur selling price bhariye. SKU, barcode, aur bulk import baad mein bhi kar sakte hain.",
            progressLabel: "Abhi yahi sabse zaroori kaam hai",
            steps: [
              {
                title: "Shop details",
                description: "Agar abhi nahi bhari hai to pehle shop ka naam aur phone jodiye.",
                href: "/business-profile",
                actionLabel: "Shop set kijiye",
              },
              {
                title: "Pehla product jodiye",
                description: "Naam aur price bharte hi aap bill banana start kar sakte hain.",
                active: true,
              },
              {
                title: "Phir customer jodiye",
                description: "Customer ka naam aur phone next step mein jod sakte hain.",
                href: "/customers",
                actionLabel: "Customers kholiye",
              },
              {
                title: "Phir bill banaiye",
                description: "Product ready hote hi seedha bill screen kholiye.",
                href: "/simple-bill",
                actionLabel: "Bill screen kholiye",
              },
            ],
            primary: "Form tak jaiye",
            secondary: "Bill page kholiye",
          }
        : {
            kicker: "Step 2",
            title: "Add your first product now",
            description:
              "Start with only the product name and selling price. SKU, barcode, and bulk import can wait until later.",
            progressLabel: "This is the only product step you need right now",
            steps: [
              {
                title: "Shop details",
                description: "If needed, add your shop name and phone first.",
                href: "/business-profile",
                actionLabel: "Set up shop",
              },
              {
                title: "Add your first product",
                description: "Once the name and price are saved, you can start making bills.",
                active: true,
              },
              {
                title: "Add a customer next",
                description: "Customer name and phone can be added in the next step.",
                href: "/customers",
                actionLabel: "Open customers",
              },
              {
                title: "Then create a bill",
                description: "As soon as the product is ready, open the bill screen.",
                href: "/simple-bill",
                actionLabel: "Open bill screen",
              },
            ],
            primary: "Jump to form",
            secondary: "Open bill page",
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

        {showBeginnerGuide ? (
          <BeginnerGuideCard
            kicker={beginnerGuideCopy.kicker}
            title={beginnerGuideCopy.title}
            description={beginnerGuideCopy.description}
            icon={Sparkles}
            progressLabel={beginnerGuideCopy.progressLabel}
            steps={beginnerGuideCopy.steps}
            primaryAction={{
              label: beginnerGuideCopy.primary,
              onClick: scrollToCreateForm,
            }}
            secondaryAction={{
              label: beginnerGuideCopy.secondary,
              href: "/simple-bill",
              variant: "outline",
            }}
          />
        ) : null}

        {canManageProducts ? (
          <section className="app-panel rounded-3xl p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("productsPage.import.title")}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {t("productsPage.import.description")}
                  </p>
                  {showBeginnerGuide ? (
                    <p className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                      Bulk import is optional. Most beginners can skip this and add one product manually.
                    </p>
                  ) : null}
                </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                >
                  {isDownloadingTemplate
                    ? t("productsPage.import.actions.preparingTemplate")
                    : t("productsPage.import.actions.downloadTemplate")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedImportFile
                    ? t("productsPage.import.actions.changeFile")
                    : t("productsPage.import.actions.chooseFile")}
                </Button>
                <Button
                  type="button"
                  onClick={handlePreviewImport}
                  disabled={isPreviewingImport || !selectedImportFile}
                >
                  {isPreviewingImport
                    ? t("productsPage.import.actions.validating")
                    : t("productsPage.import.actions.previewImport")}
                </Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleImportFileChange}
            />

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {t("productsPage.import.requirements.title")}
                </p>
                <p className="mt-3">
                  {t("productsPage.import.requirements.acceptedFiles")}
                </p>
                <p>{t("productsPage.import.requirements.maxFileSize")}</p>
                <p>{t("productsPage.import.requirements.requiredColumns")}</p>
                <p>{t("productsPage.import.requirements.optionalColumns")}</p>
                <p>{t("productsPage.import.requirements.categoryNote")}</p>
                {selectedImportFile ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                    <p className="font-medium">{selectedImportFile.name}</p>
                    <p className="mt-1">
                      {t("productsPage.import.requirements.fileSize", {
                        size: (selectedImportFile.size / 1024 / 1024).toFixed(2),
                      })}
                    </p>
                  </div>
                ) : null}
                {isPreviewingImport ? (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em]">
                      <span>{t("productsPage.import.progress.title")}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-950 transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {importSummary ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                    {t("productsPage.import.summary.success", {
                      count: importSummary.importedCount,
                    })}
                    {importSummary.skippedCount > 0
                      ? ` ${t("productsPage.import.summary.skipped", {
                          count: importSummary.skippedCount,
                        })}`
                      : ""}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-sm font-medium text-foreground">
                  {t("productsPage.import.preview.summaryTitle")}
                </p>
                {importPreview ? (
                  <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-muted/40 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("productsPage.import.preview.totalRows")}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {importPreview.summary.totalRows}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">
                          {t("productsPage.import.preview.validRows")}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-900">
                          {importPreview.summary.validRows}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-amber-700">
                          {t("productsPage.import.preview.errors")}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-amber-900">
                          {importPreview.summary.invalidRows}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handleConfirmImport}
                        disabled={
                          isConfirmingImport ||
                          importPreview.validRows.length === 0
                        }
                      >
                        {isConfirmingImport
                          ? t("productsPage.import.actions.importing")
                          : t("productsPage.import.actions.confirmImport")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDownloadErrorReport}
                        disabled={importPreview.invalidRows.length === 0}
                      >
                        {t("productsPage.import.actions.downloadErrorReport")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetImportState}
                        disabled={isConfirmingImport}
                      >
                        {t("productsPage.import.actions.clearPreview")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                    {t("productsPage.import.preview.empty")}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {importPreview ? (
          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t("productsPage.import.preview.validRows")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("productsPage.import.preview.validDescription")}
                  </p>
                </div>
                <span className="app-chip">{importPreview.validRows.length}</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("productsPage.import.table.row")}</th>
                      <th className="px-3 py-2 font-medium">{t("productsPage.import.table.name")}</th>
                      <th className="px-3 py-2 font-medium">{t("productsPage.import.table.sku")}</th>
                      <th className="px-3 py-2 font-medium">{t("productsPage.import.table.category")}</th>
                      <th className="px-3 py-2 font-medium">{t("productsPage.import.table.sellingPrice")}</th>
                      <th className="px-3 py-2 font-medium">{t("productsPage.import.table.openingStock")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.validRows.length > 0 ? (
                      importPreview.validRows.map((row) => (
                        <tr
                          key={`${row.rowNumber}-${row.sku}`}
                          className="border-t border-border/70"
                        >
                          <td className="px-3 py-3">{row.rowNumber}</td>
                          <td className="px-3 py-3 font-medium text-foreground">
                            {row.name}
                          </td>
                          <td className="px-3 py-3">{row.sku}</td>
                          <td className="px-3 py-3">
                            {row.category ||
                              t("productsPage.import.preview.uncategorized")}
                          </td>
                          <td className="px-3 py-3">{formatCurrency(row.price)}</td>
                          <td className="px-3 py-3">{row.stock}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          {t("productsPage.import.preview.noValidRows")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t("productsPage.import.preview.invalidRows")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("productsPage.import.preview.invalidDescription")}
                  </p>
                </div>
                <span className="app-chip">{importPreview.invalidRows.length}</span>
              </div>
              <div className="mt-4 space-y-3">
                {importPreview.invalidRows.length > 0 ? (
                  importPreview.invalidRows.map((row) => (
                    <div
                      key={`invalid-${row.rowNumber}`}
                      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-amber-900">
                          {t("productsPage.import.preview.rowLabel", {
                            row: row.rowNumber,
                          })}
                        </p>
                        <p className="text-xs text-amber-800">
                          {row.values.sku ||
                            row.values.name ||
                            t("productsPage.import.preview.unnamedProduct")}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-amber-900">
                        {row.errors.join(" | ")}
                      </p>
                      <p className="mt-2 text-xs text-amber-800">
                        {t("productsPage.import.preview.invalidRowSummary", {
                          name:
                            row.values.name ||
                            t("productsPage.import.preview.notAvailable"),
                          sku:
                            row.values.sku ||
                            t("productsPage.import.preview.notAvailable"),
                          sellingPrice:
                            row.values.sellingPrice ||
                            t("productsPage.import.preview.notAvailable"),
                          openingStock: row.values.openingStock || "0",
                          category:
                            row.values.category ||
                            t("productsPage.import.preview.uncategorized"),
                        })}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-8 text-center text-sm text-emerald-800">
                    {t("productsPage.import.preview.noErrors")}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="app-panel rounded-3xl p-6">
            <h2 className="text-lg font-semibold text-foreground">
              {t("productsPage.addTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("productsPage.addDescription")}
            </p>
            <form
              id="product-create-form"
              className="mt-5 grid gap-4"
              onSubmit={handleCreate}
              noValidate
            >
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
                validate={validateOptionalNumberField}
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
                {createCategory.isError ? (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    {t("productsPage.createCategoryError")}
                  </p>
                ) : null}
              </div>
              <Button
                type="submit"
                disabled={isMutating || (formTouched && !validateAll())}
                aria-disabled={isMutating || (formTouched && !validateAll())}
              >
                {t("productsPage.actions.add")}
              </Button>
              {createProduct.isError ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t("productsPage.saveError")}
                </p>
              ) : null}
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
              {!isLoading && !isError && totalProducts > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="app-chip">
                    {t("productsPage.count", { count: totalProducts })}
                  </span>
                  <DataExportDialog
                    resource="products"
                    title="Products"
                    selectedIds={selectedProductIds}
                    disabled={!canManageProducts || isLoading || isError}
                    categoryOptions={categoryOptions}
                    initialFilters={{
                      search: debouncedSearch || undefined,
                      category: selectedCategoryFilter || undefined,
                    }}
                  />
                </div>
              ) : null}
            </div>
            <div className="mt-5">
              <div className="mb-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr_auto]">
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t("productsPage.filters.searchPlaceholder")}
                />
                <select
                  className="app-field h-10 px-3 text-sm text-foreground"
                  value={selectedCategoryFilter}
                  onChange={(event) => setSelectedCategoryFilter(event.target.value)}
                >
                  <option value="">
                    {t("productsPage.filters.allCategories")}
                  </option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    {t("productsPage.filters.resultsCount", {
                      from: showingFrom,
                      to: showingTo,
                      total: totalProducts,
                    })}
                  </span>
                  {isFetching && !isLoading ? (
                    <span className="ml-3 inline-flex items-center gap-2">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {t("productsPage.filters.updating")}
                    </span>
                  ) : null}
                </div>
              </div>
              {isLoading ? <div className="app-loading-skeleton h-64 w-full" /> : null}
              {isError ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t("productsPage.loadError")}
                </p>
              ) : null}
              {!isLoading && !isError && products.length === 0 ? (
                debouncedSearch || selectedCategoryFilter ? (
                  <div className="app-empty-state text-sm">
                    {t("productsPage.filters.empty")}
                  </div>
                ) : (
                  <FriendlyEmptyState
                    icon={PackagePlus}
                    title={emptyStateCopy.title}
                    description={emptyStateCopy.description}
                    hint={emptyStateCopy.hint}
                    primaryAction={{
                      label: emptyStateCopy.primary,
                      onClick: scrollToCreateForm,
                    }}
                    secondaryAction={{
                      label: emptyStateCopy.secondary,
                      href: "/invoices",
                      variant: "outline",
                    }}
                  />
                )
              ) : null}
              {!isLoading && !isError && products.length > 0 ? (
                <>
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
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={selectedProductIds.includes(product.id)}
                                onChange={() => toggleProductSelection(product.id)}
                                aria-label={`Select ${product.name}`}
                              />
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
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {Math.max(totalPages, 1)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                        disabled={currentPage <= 1 || isFetching}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.min(page + 1, Math.max(totalPages, 1)),
                          )
                        }
                        disabled={currentPage >= totalPages || isFetching}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
