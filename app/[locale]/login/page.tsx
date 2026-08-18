import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginCard } from "@/components/admin/LoginCard";
import { getTranslations } from "next-intl/server";
import { getFirebaseAdminStatus } from "@/lib/firebase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("siteUserMenu");
  return { title: t("signIn") };
}

export default function LoginPage() {
  const adminStatus = getFirebaseAdminStatus();
  const clientMissing: string[] = [];
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) clientMissing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) clientMissing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) clientMissing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");

  const allMissing = [
    ...(adminStatus.configured ? [] : adminStatus.missing),
    ...clientMissing,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={null}>
        <LoginCard missingEnv={allMissing} />
      </Suspense>
    </div>
  );
}
