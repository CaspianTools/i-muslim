"use client";

import {
  EditorDialog,
  EditorDialogContent,
} from "@/components/ui/editor-dialog";
import type { AdminEvent } from "@/types/admin";
import { EventEditorBody } from "./EventEditorBody";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: AdminEvent | null;
  canPersist: boolean;
  onSaved: (saved: AdminEvent, mode: "create" | "update") => void;
}

export function EventEditorDrawer({ open, onOpenChange, event, canPersist, onSaved }: Props) {
  return (
    <EditorDialog open={open} onOpenChange={onOpenChange}>
      <EditorDialogContent>
        <EventEditorBody
          key={open ? "open" : "closed"}
          event={event}
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
