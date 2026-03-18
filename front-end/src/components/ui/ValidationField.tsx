import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ValidationFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
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
}

export const ValidationField: React.FC<ValidationFieldProps> = ({
  id,
  label,
  value,
  onChange,
  onBlur,
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
}) => {
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");

  // Debounced validation
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <div className="mb-2">
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
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
          "block w-full rounded-md border px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 transition-all",
          showError
            ? "border-red-500 focus:ring-red-200"
            : showSuccess
              ? "border-green-500 focus:ring-green-200"
              : "border-gray-300 focus:ring-indigo-200",
        )}
      />
      {showError && (
        <span
          id={`${id}-error`}
          className="mt-1 text-xs text-red-600 block"
          role="alert"
        >
          {error}
        </span>
      )}
      {showSuccess && (
        <span className="mt-1 text-xs text-green-600 block" role="status">
          ✓
        </span>
      )}
    </div>
  );
};
