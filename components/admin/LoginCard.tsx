"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, LogIn } from "lucide-react";
import { signInWithGoogle } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginCard({ missingEnv }: { missingEnv: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/admin";
  const t = useTranslations("auth");

  const isConfigured = missingEnv.length === 0;

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
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
      router.push(callbackUrl);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("signInFailed");
      setError(message);
    } finally {
      setLoading(false);
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

        <Button
          className="w-full"
          onClick={handleSignIn}
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

        <p className="text-center text-xs text-muted-foreground">
          {t("limitedAccessNote")}
        </p>

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
