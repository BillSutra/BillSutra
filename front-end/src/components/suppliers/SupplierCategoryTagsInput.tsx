"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SupplierCategoryTagsInputProps = {
  label: string;
  placeholder: string;
  value: string[];
  suggestions?: string[];
  helperText?: string;
  onChange: (next: string[]) => void;
};

const normalizeCategory = (raw: string) =>
  raw.replace(/\s+/g, " ").trim().slice(0, 60);

const dedupeCategories = (categories: string[]) => {
  const unique: string[] = [];
  const seen = new Set<string>();

  categories.forEach((entry) => {
    const normalized = normalizeCategory(entry);
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(normalized);
  });

  return unique;
};

const SupplierCategoryTagsInput = ({
  label,
  placeholder,
  value,
  suggestions = [],
  helperText,
  onChange,
}: SupplierCategoryTagsInputProps) => {
  const [draft, setDraft] = useState("");

  const normalizedSuggestions = useMemo(
    () => dedupeCategories(suggestions).slice(0, 12),
    [suggestions],
  );

  const selectedKeys = useMemo(
    () => new Set(value.map((entry) => normalizeCategory(entry).toLowerCase())),
    [value],
  );

  const addCategory = (raw: string) => {
    const next = normalizeCategory(raw);
    if (!next) {
      return;
    }

    if (selectedKeys.has(next.toLowerCase())) {
      return;
    }

    onChange(dedupeCategories([...value, next]));
  };

  const removeCategory = (target: string) => {
    const targetKey = normalizeCategory(target).toLowerCase();
    onChange(
      value.filter(
        (entry) => normalizeCategory(entry).toLowerCase() !== targetKey,
      ),
    );
  };

  const commitDraft = () => {
    if (!draft.trim()) {
      setDraft("");
      return;
    }

    const chunks = draft
      .split(",")
      .map((entry) => normalizeCategory(entry))
      .filter(Boolean);

    if (!chunks.length) {
      setDraft("");
      return;
    }

    onChange(dedupeCategories([...value, ...chunks]));
    setDraft("");
  };

  return (
    <div className="grid gap-2">
      <label
        htmlFor="supplier-categories"
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>

      <div className="rounded-xl border border-border bg-background p-2">
        <div className="flex flex-wrap items-center gap-2">
          {value.map((entry) => (
            <Badge
              key={entry}
              variant="default"
              className="gap-1 rounded-full border-[#e4d2c4] bg-[#fff6ee] text-[#6c5646]"
            >
              <span>{entry}</span>
              <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[#8a6d56] hover:bg-[#f1dfd0]"
                onClick={() => removeCategory(entry)}
                aria-label={`Remove ${entry}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Input
              id="supplier-categories"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commitDraft();
                }
              }}
              placeholder={placeholder}
              className="h-8 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0"
            />
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={commitDraft}
              aria-label="Add category"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {normalizedSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {normalizedSuggestions
            .filter((entry) => !selectedKeys.has(entry.toLowerCase()))
            .map((entry) => (
              <Button
                key={entry}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full"
                onClick={() => addCategory(entry)}
              >
                {entry}
              </Button>
            ))}
        </div>
      ) : null}

      {helperText ? (
        <p className="text-xs text-[#8a6d56]">{helperText}</p>
      ) : null}
    </div>
  );
};

export default SupplierCategoryTagsInput;
