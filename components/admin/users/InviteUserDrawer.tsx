"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AdminUser } from "@/types/admin";

type Values = {
  name: string;
  email: string;
  role: "admin" | "moderator" | "scholar" | "member";
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (user: AdminUser) => void;
}

export function InviteUserDrawer({ open, onOpenChange, onInvite }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations("users.invite");
  const tCommon = useTranslations("common");
  const tRoles = useTranslations("users.roles");

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t("errorName")),
        email: z.string().email(t("errorEmail")),
        role: z.enum(["admin", "moderator", "scholar", "member"]),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", role: "member" },
  });

  async function onSubmit(values: Values) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite user");
      onInvite(data.user as AdminUser);
      reset();
      onOpenChange(false);
    } catch (err) {
      const { toast } = await import("@/components/ui/sonner");
      toast.error(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">{t("fullName")}</Label>
            <Input id="invite-name" autoComplete="name" {...register("name")} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">{t("emailLabel")}</Label>
            <Input id="invite-email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">{t("roleLabel")}</Label>
            <select
              id="invite-role"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              {...register("role")}
            >
              <option value="member">{tRoles("member")}</option>
              <option value="scholar">{tRoles("scholar")}</option>
              <option value="moderator">{tRoles("moderator")}</option>
              <option value="admin">{tRoles("admin")}</option>
            </select>
          </div>
          <SheetFooter className="-mx-5 mt-auto">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? t("sending") : <><Send /> {t("send")}</>}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
