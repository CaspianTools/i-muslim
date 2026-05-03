"use client";

import {
  EditorDialog,
  EditorDialogContent,
} from "@/components/ui/editor-dialog";
import type {
  Business,
  BusinessAmenity,
  BusinessCategory,
  BusinessCertificationBody,
} from "@/types/business";
import { BusinessEditorBody } from "./BusinessEditorBody";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business?: Business | null;
  categories: BusinessCategory[];
  amenities: BusinessAmenity[];
  certBodies: BusinessCertificationBody[];
  canPersist: boolean;
  onSaved: (saved: Business, mode: "create" | "update") => void;
}

export function BusinessEditorDrawer({
  open,
  onOpenChange,
  business,
  categories,
  amenities,
  certBodies,
  canPersist,
  onSaved,
}: Props) {
  return (
    <EditorDialog open={open} onOpenChange={onOpenChange}>
      <EditorDialogContent>
        <BusinessEditorBody
          key={open ? "open" : "closed"}
          business={business}
          categories={categories}
          amenities={amenities}
          certBodies={certBodies}
          canPersist={canPersist}
          onSaved={(saved, mode) => {
            onSaved(saved, mode);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </EditorDialogContent>
    </EditorDialog>
  );
}
