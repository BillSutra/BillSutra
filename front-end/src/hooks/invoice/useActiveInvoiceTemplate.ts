"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTIVE_INVOICE_TEMPLATE_EVENT,
  type ActiveInvoiceTemplateInput,
  type ActiveInvoiceTemplateSnapshot,
  createActiveInvoiceTemplateSnapshot,
  resolveActiveInvoiceTemplate,
} from "@/lib/invoiceActiveTemplate";

export const useActiveInvoiceTemplate = (
  fallback: ActiveInvoiceTemplateInput,
) => {
  const normalizedFallback = useMemo(
    () => createActiveInvoiceTemplateSnapshot(fallback),
    [fallback],
  );
  const [activeTemplate, setActiveTemplate] =
    useState<ActiveInvoiceTemplateSnapshot>(normalizedFallback);

  useEffect(() => {
    setActiveTemplate(resolveActiveInvoiceTemplate(normalizedFallback));
  }, [normalizedFallback]);

  useEffect(() => {
    const syncTemplate = () => {
      setActiveTemplate(resolveActiveInvoiceTemplate(normalizedFallback));
    };

    const handleTemplateEvent = (event: Event) => {
      const templateEvent = event as CustomEvent<ActiveInvoiceTemplateSnapshot>;
      if (templateEvent.detail) {
        setActiveTemplate(templateEvent.detail);
        return;
      }
      syncTemplate();
    };

    window.addEventListener("storage", syncTemplate);
    window.addEventListener(
      ACTIVE_INVOICE_TEMPLATE_EVENT,
      handleTemplateEvent as EventListener,
    );

    return () => {
      window.removeEventListener("storage", syncTemplate);
      window.removeEventListener(
        ACTIVE_INVOICE_TEMPLATE_EVENT,
        handleTemplateEvent as EventListener,
      );
    };
  }, [normalizedFallback]);

  return activeTemplate;
};
