"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AlertCircle, LogIn, MailCheck } from "lucide-react";
import type { User } from "firebase/auth";
import {
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  resendVerificationEmail,
  sendPasswordReset,
} from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginCard({ missingEnv }: { missingEnv: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const rawCallback = params.get("callbackUrl");
  const t = useTranslations("auth");

  // Callback URLs from the proxy already include a locale prefix (e.g.
  // "/en/admin/users"). Strip it so next-intl router.push doesn't double-prefix.
  const callbackTarget = rawCallback
    ? rawCallback.replace(/^\/(en|ar|tr|id)(?=\/|$)/, "") || "/admin"
    : "/admin";

  const isConfigured = missingEnv.length === 0;

  // Exchange a Firebase user for a session cookie. The session endpoint rejects
  // unverified emails (security boundary), so gate on emailVerified first.
  async function finishSession(user: User) {
    if (!user.emailVerified) {
      setNeedsVerification(true);
      setNotice(t("verifyEmailSent", { email: user.email ?? email }));
      return;
    }
    const idToken = await user.getIdToken(true);
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? t("signInFailed"));
    }
    router.push(callbackTarget);
    router.refresh();
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await finishSession(await signInWithGoogle());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("signInFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    setNeedsVerification(false);
    try {
      if (mode === "register") {
        if (password.length < 6) throw new Error(t("passwordTooShort"));
        await registerWithEmail(email, password);
        // Newly created → unverified. Don't create a session yet.
        setNeedsVerification(true);
        setNotice(t("verifyEmailSent", { email }));
      } else {
        await finishSession(await signInWithEmail(email, password));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("signInFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    try {
      await resendVerificationEmail();
      setNotice(t("verificationResent"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("signInFailed"));
    }
  }

  async function handleForgot() {
    setError(null);
    setNotice(null);
    if (!email) {
      setError(t("email"));
      return;
    }
    try {
      await sendPasswordReset(email);
      setNotice(t("passwordResetSent"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("signInFailed"));
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-base mb-2">
          ۞
        </div>
        <CardTitle className="text-lg">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-0">
        {!isConfigured && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 mt-0.5 shrink-0 text-warning" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">{t("notConfigured")}</p>
                <p className="text-muted-foreground">
                  {t.rich("notConfiguredHelp", {
                    file: () => (
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                        .env.local
                      </code>
                    ),
                  })}
                </p>
                <ul className="mt-1 list-disc ps-4 text-xs text-muted-foreground">
                  {missingEnv.map((v) => (
                    <li key={v} className="font-mono">{v}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <MailCheck className="size-4 mt-0.5 shrink-0 text-success" />
              <p>{notice}</p>
            </div>
          </div>
        )}

        {needsVerification ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">{t("verifyEmailTitle")}</p>
            <Button variant="secondary" className="w-full" onClick={handleResend} disabled={!isConfigured}>
              {t("resendVerification")}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setNeedsVerification(false);
                setMode("signin");
                setNotice(null);
              }}
            >
              {t("haveAccountCta")}
            </button>
          </div>
        ) : (
          <>
            <Button
              className="w-full"
              onClick={handleGoogle}
              disabled={loading || !isConfigured}
              aria-busy={loading}
            >
              {loading ? (
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <LogIn className="size-4" />
              )}
              {t("continueWithGoogle")}
            </Button>

            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("orDivider")}
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">{t("email")}</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  placeholder={t("emailPlaceholder")}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isConfigured}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">{t("password")}</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!isConfigured}
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                disabled={loading || !isConfigured}
                aria-busy={loading}
              >
                {mode === "register" ? t("createAccount") : t("continueWithEmail")}
              </Button>
            </form>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setMode((m) => (m === "signin" ? "register" : "signin"));
                  setError(null);
                  setNotice(null);
                }}
              >
                {mode === "signin" ? t("createAccountCta") : t("haveAccountCta")}
              </button>
              {mode === "signin" && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  onClick={handleForgot}
                >
                  {t("forgotPassword")}
                </button>
              )}
            </div>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">{t("limitedAccessNote")}</p>

        <div className="pt-2 text-center">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {t("backToSite")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
