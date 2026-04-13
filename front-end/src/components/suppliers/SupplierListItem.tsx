"use client";

import { Building2, IndianRupee, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Supplier } from "@/lib/apiClient";

type SupplierListItemProps = {
  supplier: Supplier;
  outstandingLabel: string;
  gstinLabel: string;
  categoriesLabel: string;
  editLabel: string;
  deleteLabel: string;
  noGstinLabel: string;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplierId: number) => void;
  disableDelete?: boolean;
};

const SupplierListItem = ({
  supplier,
  outstandingLabel,
  gstinLabel,
  categoriesLabel,
  editLabel,
  deleteLabel,
  noGstinLabel,
  onEdit,
  onDelete,
  disableDelete = false,
}: SupplierListItemProps) => {
  const resolvedName =
    supplier.businessName || supplier.business_name || supplier.name;
  const outstanding = Number(
    supplier.outstandingBalance ?? supplier.outstanding_balance ?? 0,
  );
  const categories = supplier.categories ?? [];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-[0_18px_34px_-34px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {resolvedName}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <Phone className="h-3.5 w-3.5" />
            {supplier.phone || "-"}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <Building2 className="h-3.5 w-3.5" />
            {gstinLabel}: {supplier.gstin || noGstinLabel}
          </p>
          {categories.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {categoriesLabel}:
              </span>
              {categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-[#e6d6c9] bg-[#fff5eb] px-2 py-0.5 text-[11px] text-[#725b48]"
                >
                  {category}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {outstandingLabel}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <IndianRupee className="h-3.5 w-3.5" />
            {Number.isFinite(outstanding)
              ? outstanding.toLocaleString("en-IN")
              : "0"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEdit(supplier)}
        >
          {editLabel}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => onDelete(supplier.id)}
          disabled={disableDelete}
        >
          {deleteLabel}
        </Button>
      </div>
    </article>
  );
};

export default SupplierListItem;
