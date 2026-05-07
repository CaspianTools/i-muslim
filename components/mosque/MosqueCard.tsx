import Link from "next/link";
import Image from "next/image";
import { MapPin, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Mosque } from "@/types/mosque";
import { countryName } from "@/lib/mosques/countries";
import { initials } from "@/lib/utils";

export function MosqueCard({ mosque }: { mosque: Mosque }) {
  const t = useTranslations("mosques.actions");
  return (
    <Link
      href={`/mosques/${mosque.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-accent"
    >
      {/* Image area shrinks at <md so 2-3 cards fit above the fold instead of
          one half-card; on md+ keeps the visual weight it had. */}
      <div className="relative h-[120px] md:h-auto md:aspect-[16/9] w-full bg-muted">
        {mosque.coverImage?.url ? (
          <Image
            src={mosque.coverImage.url}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          // Monogram fallback — far less visually noisy than 30 cards each
          // showing the same starburst placeholder.
          <div className="flex h-full w-full items-center justify-center bg-[var(--selected)] text-2xl md:text-3xl font-semibold text-[var(--selected-foreground)]">
            {initials(mosque.name.en)}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-semibold leading-snug text-foreground">{mosque.name.en}</h3>
          {mosque.name.ar && (
            <p dir="rtl" lang="ar" className="font-arabic text-sm text-muted-foreground">
              {mosque.name.ar}
            </p>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5" /> {mosque.city}, {countryName(mosque.country)}
        </p>
        {mosque.description?.en && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{mosque.description.en}</p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-accent">
          {t("viewDetails")} <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
        </span>
      </div>
    </Link>
  );
}
