import { useCallback, useEffect, useState } from "react";
import type {
  InvoiceDraft,
  InvoiceFormState,
  InvoiceItemForm,
  TaxMode,
} from "@/types/invoice";

type UseInvoiceDraftsParams = {
  form: InvoiceFormState;
  items: InvoiceItemForm[];
  taxMode: TaxMode;
  onLoadDraft: (draft: InvoiceDraft) => void;
  maxDrafts?: number;
  autoSaveDelayMs?: number;
};

const DRAFTS_KEY = "billSutra:invoiceDrafts";

const readDrafts = (): InvoiceDraft[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(DRAFTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as InvoiceDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeDrafts = (drafts: InvoiceDraft[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

export const formatRelativeTime = (value: Date, locale = "en-IN") => {
  const diffMs = Date.now() - value.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) {
    return locale.startsWith("hi") ? "अभी-अभी" : "just now";
  }
  if (minutes < 60) {
    return locale.startsWith("hi") ? `${minutes}मि पहले` : `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return locale.startsWith("hi") ? `${hours}घं पहले` : `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return locale.startsWith("hi") ? `${days}दिन पहले` : `${days}d ago`;
};

export const useInvoiceDrafts = ({
  form,
  items,
  taxMode,
  onLoadDraft,
  maxDrafts = 20,
  autoSaveDelayMs = 1500,
}: UseInvoiceDraftsParams) => {
  const [drafts, setDrafts] = useState<InvoiceDraft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const saveDraft = useCallback(
    (createNew?: boolean) => {
      const id = createNew || !draftId ? `draft-${Date.now()}` : draftId;
      const savedAt = new Date().toISOString();
      const draft: InvoiceDraft = {
        id,
        savedAt,
        form,
        taxMode,
        items,
      };
      const nextDrafts = readDrafts().filter((item) => item.id !== id);
      nextDrafts.unshift(draft);
      const trimmed = nextDrafts.slice(0, maxDrafts);
      writeDrafts(trimmed);
      setDrafts(trimmed);
      setDraftId(id);
      setLastSavedAt(new Date(savedAt));
      setIsDirty(false);
    },
    [draftId, form, items, taxMode, maxDrafts],
  );

  const saveNewDraft = useCallback(() => saveDraft(true), [saveDraft]);

  const clearDraft = useCallback(() => {
    if (!draftId) return;
    const nextDrafts = readDrafts().filter((item) => item.id !== draftId);
    writeDrafts(nextDrafts);
    setDrafts(nextDrafts);
    setDraftId(null);
    setLastSavedAt(null);
    setIsDirty(false);
  }, [draftId]);

  const loadDraft = useCallback(
    (draft: InvoiceDraft) => {
      setDraftId(draft.id);
      setLastSavedAt(new Date(draft.savedAt));
      setIsDirty(false);
      onLoadDraft(draft);
    },
    [onLoadDraft],
  );

  const deleteDraft = useCallback(
    (id: string) => {
      const nextDrafts = readDrafts().filter((item) => item.id !== id);
      writeDrafts(nextDrafts);
      setDrafts(nextDrafts);
      if (draftId === id) {
        setDraftId(null);
        setLastSavedAt(null);
        setIsDirty(false);
      }
    },
    [draftId],
  );

  useEffect(() => {
    const storedDrafts = readDrafts();
    setDrafts(storedDrafts);
    if (storedDrafts.length === 0) return;
    const [latest] = [...storedDrafts].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    );
    if (latest) {
      loadDraft(latest);
    }
  }, [loadDraft]);

  useEffect(() => {
    if (!isDirty) return;
    const handle = window.setTimeout(() => {
      saveDraft(false);
    }, autoSaveDelayMs);
    return () => window.clearTimeout(handle);
  }, [autoSaveDelayMs, isDirty, saveDraft]);

  return {
    drafts,
    draftId,
    lastSavedAt,
    isDirty,
    markDirty,
    saveDraft,
    saveNewDraft,
    loadDraft,
    deleteDraft,
    clearDraft,
  };
};
