"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type AuthFormFieldProps = {
  id: string;
  name: string;
  label: string;
  type?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  pattern?: string;
  autoCapitalize?: InputHTMLAttributes<HTMLInputElement>["autoCapitalize"];
  autoFocus?: boolean;
  disabled?: boolean;
  error?: string;
  valid?: boolean;
  helperText?: string;
  leftAdornment?: ReactNode;
  rightAdornment?: ReactNode;
  wrapperClassName?: string;
  inputClassName?: string;
};

const AuthFormField = ({
  id,
  name,
  label,
  type = "text",
  value,
  placeholder,
  onChange,
  onBlur,
  autoComplete,
  inputMode,
  maxLength,
  pattern,
  autoCapitalize,
  autoFocus,
  disabled,
  error,
  valid,
  helperText,
  leftAdornment,
  rightAdornment,
  wrapperClassName,
  inputClassName,
}: AuthFormFieldProps) => {
  const helperId = helperText ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;
  const showValidState = Boolean(valid && !error && value.trim());

  return (
    <div className={cn("grid gap-2", wrapperClassName)}>
      <Label
        htmlFor={id}
        className="text-sm font-medium tracking-[0.01em] text-foreground"
      >
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          pattern={pattern}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            "h-12 rounded-2xl border-border/70 bg-background/75 text-[0.95rem] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.38)] transition-[border-color,box-shadow,background-color,transform] duration-200 placeholder:text-muted-foreground/80 hover:border-primary/35 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 dark:bg-background/60",
            error
              ? "border-destructive focus-visible:ring-destructive/20"
              : showValidState
                ? "border-emerald-500/70 focus-visible:ring-emerald-500/20"
                : "",
            leftAdornment ? "pl-11" : "",
            rightAdornment || showValidState ? "pr-12" : "",
            inputClassName,
          )}
        />
        {leftAdornment ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted-foreground">
            {leftAdornment}
          </div>
        ) : null}
        {rightAdornment ? (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {rightAdornment}
          </div>
        ) : showValidState ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-emerald-500">
            <Check aria-hidden="true" className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      {error ? (
        <span id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className="text-xs text-muted-foreground">
          {helperText}
        </span>
      ) : null}
    </div>
  );
};

export default AuthFormField;
