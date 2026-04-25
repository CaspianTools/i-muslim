"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (val: number) => void;
}

export function NumericInput({
  value,
  onChange,
  className,
  step = "any",
  placeholder = "0.00",
  ...rest
}: NumericInputProps) {
  const [local, setLocal] = React.useState(value === 0 ? "" : value.toString());
  const [lastProp, setLastProp] = React.useState(value);

  if (lastProp !== value) {
    setLastProp(value);
    if (parseFloat(local) !== value) {
      setLocal(value === 0 ? "" : value.toString());
    }
  }

  return (
    <input
      {...rest}
      type="number"
      step={step}
      value={local}
      placeholder={placeholder}
      inputMode="decimal"
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "tabular-nums",
        className,
      )}
      onChange={(e) => {
        const next = e.target.value;
        setLocal(next);
        if (next === "") {
          onChange(0);
          return;
        }
        const parsed = parseFloat(next);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
    />
  );
}
