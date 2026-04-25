"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
  website_url_secondary: string;
}

const empty: FormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
  website_url_secondary: "",
};

export function ContactForm() {
  const t = useTranslations("legal.contact.form");
  const locale = useLocale();
  const [state, setState] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (state.name.trim().length < 2) next.name = t("validation.nameRequired");
    if (!/^.+@.+\..+$/.test(state.email.trim())) next.email = t("validation.emailInvalid");
    if (state.subject.trim().length < 2) next.subject = t("validation.subjectRequired");
    const msg = state.message.trim();
    if (msg.length < 10) next.message = t("validation.messageRequired");
    else if (msg.length > 5000) next.message = t("validation.messageTooLong");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.status === 429) {
        toast.error(t("errorRate"));
        return;
      }
      if (res.status === 503 && data.error === "firestore_not_configured") {
        toast.error(t("errorNotConfigured"));
        return;
      }
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? t("errorGeneric"));
        return;
      }
      toast.success(t("success"));
      setState(empty);
      setDone(true);
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-base font-medium text-foreground">{t("success")}</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => {
            setDone(false);
            setErrors({});
          }}
        >
          {t("successAck")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">{t("name")}</Label>
          <Input
            id="contact-name"
            value={state.name}
            placeholder={t("namePlaceholder")}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            aria-invalid={!!errors.name}
            autoComplete="name"
            maxLength={120}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-email">{t("email")}</Label>
          <Input
            id="contact-email"
            type="email"
            value={state.email}
            placeholder={t("emailPlaceholder")}
            onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
            aria-invalid={!!errors.email}
            autoComplete="email"
            maxLength={200}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-subject">{t("subject")}</Label>
        <Input
          id="contact-subject"
          value={state.subject}
          placeholder={t("subjectPlaceholder")}
          onChange={(e) => setState((s) => ({ ...s, subject: e.target.value }))}
          aria-invalid={!!errors.subject}
          maxLength={200}
        />
        {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message">{t("message")}</Label>
        <textarea
          id="contact-message"
          value={state.message}
          placeholder={t("messagePlaceholder")}
          onChange={(e) => setState((s) => ({ ...s, message: e.target.value }))}
          aria-invalid={!!errors.message}
          rows={7}
          maxLength={5000}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
      </div>

      {/* Honeypot — leave empty; real users won't see it */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="contact-website-2">Website</label>
        <input
          id="contact-website-2"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={state.website_url_secondary}
          onChange={(e) => setState((s) => ({ ...s, website_url_secondary: e.target.value }))}
        />
      </div>

      <Button type="submit" disabled={submitting} className="min-w-32">
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> {t("submitting")}
          </>
        ) : (
          <>
            <Send className="size-4" /> {t("submit")}
          </>
        )}
      </Button>
    </form>
  );
}
