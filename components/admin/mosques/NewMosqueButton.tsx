"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openQuickCreate } from "@/components/admin/QuickCreate";
import { useCanCreate } from "@/components/admin/PermissionsContext";

export function NewMosqueButton({ label }: { label: string }) {
  const canCreate = useCanCreate("mosque");
  if (!canCreate) return null;
  return (
    <Button size="sm" onClick={() => openQuickCreate("mosque")}>
      <Plus /> {label}
    </Button>
  );
}
