"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUSD } from "@/lib/zakat/calculate";
import { cn } from "@/lib/utils";

interface Props {
  icon: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  subtotal?: { label: string; value: number } | null;
}

export function AssetSection({
  icon,
  title,
  trailing,
  children,
  onAdd,
  addLabel,
  subtotal,
}: Props) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
        <h3 className="text-xs uppercase tracking-widest font-semibold text-foreground flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          {title}
        </h3>
        {trailing}
      </div>

      <div className="space-y-3">{children}</div>

      {onAdd && (
        <Button
          type="button"
          variant="secondary"
          onClick={onAdd}
          className="mt-4 w-full border-dashed text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      )}

      {subtotal && (
        <SubtotalRow label={subtotal.label} value={subtotal.value} />
      )}
    </Card>
  );
}

function SubtotalRow({ label, value }: { label: string; value: number }) {
  const [flash, setFlash] = React.useState(false);
  const prev = React.useRef(value);

  React.useEffect(() => {
    if (prev.current !== value) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 300);
      prev.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
      <span className="text-xs text-muted-foreground italic">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums transition-colors duration-300",
          flash ? "text-warning" : "text-primary",
        )}
      >
        {formatUSD(value)}
      </span>
    </div>
  );
}
