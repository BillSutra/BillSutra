import React, { useCallback, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/LanguageProvider";
import { translateValidationMessage } from "@/lib/validation";

interface ValidationFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  as?: "input" | "select";
  type?: string;
  placeholder?: string;
  validate: (value: string) => string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  success?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const ValidationField: React.FC<ValidationFieldProps> = ({
  id,
  label,
  value,
  onChange,
  onBlur,
  as = "input",
  type = "text",
  placeholder,
  validate,
  required = false,
  min,
  max,
  step,
  success = false,
  autoComplete,
  disabled = false,
  className,
  children,
}) => {
  const { t } = useI18n();
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange(e.target.value);
      setTouched(true);
      setTimeout(() => {
        setError(validate(e.target.value));
      }, 200);
    },
    [onChange, validate],
  );

  const handleBlur = () => {
    setTouched(true);
    setError(validate(value));
    onBlur?.();
  };

  const showError = touched && !!error;
  const showSuccess = touched && !error && value.length > 0 && success;

  return (
    <div className={cn("mb-2", className)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {as === "select" ? (
        <select
          id={id}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          aria-invalid={showError}
          aria-describedby={showError ? `${id}-error` : undefined}
          className={cn(
            "app-field block h-10 w-full px-3 py-2 text-base focus:outline-none focus:ring-2 transition-all md:text-sm",
            showError
              ? "border-red-500/85 focus:ring-red-500/25"
              : showSuccess
                ? "border-emerald-500/80 focus:ring-emerald-500/25"
                : "focus:ring-ring/30",
          )}
        >
          {children}
        </select>
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={showError}
          aria-describedby={showError ? `${id}-error` : undefined}
          className={cn(
            "app-field block h-10 w-full px-3 py-2 text-base focus:outline-none focus:ring-2 transition-all md:text-sm",
            showError
              ? "border-red-500/85 focus:ring-red-500/25"
              : showSuccess
                ? "border-emerald-500/80 focus:ring-emerald-500/25"
                : "focus:ring-ring/30",
          )}
        />
      )}
      {showError && (
        <span
          id={`${id}-error`}
          className="mt-1 block text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          {translateValidationMessage(t, error)}
        </span>
      )}
      {showSuccess && (
        <span
          className="mt-1 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400"
          role="status"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("common.looksGood")}
        </span>
      )}
    </div>
  );
};
