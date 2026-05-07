"use client";

import {
  EditorDialog,
  EditorDialogContent,
} from "@/components/ui/editor-dialog";
import type { AdminEvent } from "@/types/admin";
import type { EventCategoryDoc } from "@/types/event-category";
import type { MosqueOption } from "@/components/common/MosqueCombobox";
import { EventEditorBody } from "./EventEditorBody";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: AdminEvent | null;
  canPersist: boolean;
  categories: EventCategoryDoc[];
  mosques: MosqueOption[];
  onSaved: (saved: AdminEvent, mode: "create" | "update") => void;
}

export function EventEditorDrawer({
  open,
  onOpenChange,
  event,
  canPersist,
  categories,
  mosques,
  onSaved,
}: Props) {
  return (
    <EditorDialog open={open} onOpenChange={onOpenChange}>
      <EditorDialogContent>
        <EventEditorBody
          key={open ? "open" : "closed"}
          event={event}
          canPersist={canPersist}
          categories={categories}
          mosques={mosques}
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
