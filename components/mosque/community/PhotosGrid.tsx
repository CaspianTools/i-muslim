import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Mosque } from "@/types/mosque";

/** Center-column photo gallery (#photos sub-tab target). Hidden when empty. */
export async function PhotosGrid({ mosque }: { mosque: Mosque }) {
  const t = await getTranslations("mosques.community");
  const gallery = (mosque.gallery ?? []).filter((g) => g?.url);
  if (gallery.length === 0) return null;

  return (
    <section id="photos" className="mq-card mq-card-pad scroll-mt-24">
      <h2 className="mq-rail-title">{t("photosTitle")}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {gallery.slice(0, 9).map((g, i) => (
          <div
            key={g.storagePath ?? i}
            className="relative aspect-square overflow-hidden rounded-lg border border-border"
          >
            <Image
              src={g.url}
              alt={g.alt ?? ""}
              fill
              sizes="(min-width: 1024px) 300px, 50vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
