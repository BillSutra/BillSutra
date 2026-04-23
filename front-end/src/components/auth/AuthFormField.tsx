"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  autoFocus?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  rightAdornment?: ReactNode;
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
  autoFocus,
  disabled,
  error,
  helperText,
  rightAdornment,
}: AuthFormFieldProps) => {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
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
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={cn(
            "transition-[border-color,box-shadow,background-color] duration-200",
            rightAdornment ? "pr-12" : "",
          )}
        />
        {rightAdornment ? (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {rightAdornment}
          </div>
        ) : null}
      </div>
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-muted-foreground">{helperText}</span>
      ) : null}
    </div>
  );
};

export default AuthFormField;
