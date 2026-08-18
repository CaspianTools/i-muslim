"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const EditorDialog = DialogPrimitive.Root;
export const EditorDialogTrigger = DialogPrimitive.Trigger;
export const EditorDialogClose = DialogPrimitive.Close;
export const EditorDialogPortal = DialogPrimitive.Portal;

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMobile;
}

const EditorDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
EditorDialogOverlay.displayName = "EditorDialogOverlay";

export interface EditorDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideClose?: boolean;
}

export const EditorDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  EditorDialogContentProps
>(({ className, children, hideClose, ...props }, ref) => {
  const isMobile = useIsMobile();

  const desktopClass =
    "fixed left-1/2 top-1/2 z-50 flex w-[90vw] h-[90vh] max-w-[1200px] max-h-[900px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl " +
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";

  const t = useTranslations("common");

  const mobileClass =
    "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col overflow-hidden border-l border-border bg-card text-card-foreground shadow-lg transition ease-in-out " +
    "data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right";

  return (
    <EditorDialogPortal>
      <EditorDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(isMobile ? mobileClass : desktopClass, className)}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label={t("close")}
            className="absolute right-4 top-4 rounded-sm text-muted-foreground transition-opacity hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </EditorDialogPortal>
  );
});
EditorDialogContent.displayName = "EditorDialogContent";

export function EditorDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-border p-5 pe-12",
        className,
      )}
      {...props}
    />
  );
}

export function EditorDialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto p-5", className)}
      {...props}
    />
  );
}

export function EditorDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-border p-5",
        className,
      )}
      {...props}
    />
  );
}

export const EditorDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold text-foreground", className)}
    {...props}
  />
));
EditorDialogTitle.displayName = "EditorDialogTitle";

export const EditorDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
EditorDialogDescription.displayName = "EditorDialogDescription";
