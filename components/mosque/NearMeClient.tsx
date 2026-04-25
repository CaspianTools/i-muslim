"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNearParam } from "@/lib/mosques/geo";

type State = "idle" | "locating" | "denied" | "unsupported" | "error";

export function NearMeClient() {
  const router = useRouter();
  const t = useTranslations("mosques.nearMe");
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function request() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = formatNearParam(pos.coords.latitude, pos.coords.longitude, 25);
        router.replace(`/mosques?near=${near}`);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState("denied");
        else setState("error");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-4">
      {state === "locating" && (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t("locating")}
        </p>
      )}
      {state === "denied" && (
        <p className="text-sm text-muted-foreground">{t("denied")}</p>
      )}
      {state === "unsupported" && (
        <p className="text-sm text-muted-foreground">{t("unsupported")}</p>
      )}
      {state === "error" && (
        <p className="text-sm text-muted-foreground">{t("denied")}</p>
      )}
      {state !== "locating" && (
        <div className="flex items-center gap-2">
          <Button onClick={request}>
            <MapPin /> {t("tryAgain")}
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/mosques">{t("browseAll")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
