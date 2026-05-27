import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import {
  QURAN_TRANSLATION_CATALOG,
  HADITH_TRANSLATION_CATALOG,
  HADITH_COLLECTION_SLUGS,
  type TranslationCatalogEntry,
} from "@/lib/translations/catalog";

// NEXT_PUBLIC_SITE_URL is sometimes set without a scheme (e.g. "i-muslim.com"),
// which produces invalid canonical and JSON-LD URLs that search engines reject.
// Defensive prepend.
function absoluteSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "https://i-muslim.com";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}
const SITE_URL = absoluteSiteUrl();

const PAGE_TITLE =
  "Free Quran and Hadith translation downloads (JSON) — i-muslim";
const PAGE_DESCRIPTION =
  "Download the Quran and the major Hadith collections (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Malik, Nawawi 40, Qudsi 40) as JSON. Arabic original is public-domain; modern translations (Saheeh International, Kuliev, Musayev, Diyanet, fawazahmed0) are listed with full provenance and the upstream URL to fetch the text. Free, no API key, CORS-open, machine-readable.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/downloads` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/downloads`,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: "i-muslim",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
  keywords: [
    "Quran download",
    "Quran JSON",
    "Quran translation download",
    "Hadith download",
    "Hadith JSON",
    "Bukhari JSON",
    "Sahih Muslim JSON",
    "Abu Dawud JSON",
    "Tirmidhi JSON",
    "open Islamic data",
    "Islamic API",
    "Quran API",
    "Hadith API",
  ],
  robots: { index: true, follow: true },
};

const LANG_NAMES: Record<string, string> = {
  ar: "Arabic",
  en: "English",
  ru: "Russian",
  az: "Azerbaijani",
  tr: "Turkish",
};

const COLLECTION_DISPLAY: Record<
  (typeof HADITH_COLLECTION_SLUGS)[number],
  { name: string; nameAr: string; hadithCount: number }
> = {
  bukhari: { name: "Sahih al-Bukhari", nameAr: "صحيح البخاري", hadithCount: 7563 },
  muslim: { name: "Sahih Muslim", nameAr: "صحيح مسلم", hadithCount: 7563 },
  abudawud: { name: "Sunan Abu Dawud", nameAr: "سنن أبي داود", hadithCount: 5274 },
  tirmidhi: { name: "Jami` at-Tirmidhi", nameAr: "جامع الترمذي", hadithCount: 3956 },
  nasai: { name: "Sunan an-Nasa'i", nameAr: "سنن النسائي", hadithCount: 5761 },
  ibnmajah: { name: "Sunan Ibn Majah", nameAr: "سنن ابن ماجه", hadithCount: 4341 },
  malik: { name: "Muwatta Malik", nameAr: "موطأ مالك", hadithCount: 1851 },
  nawawi: { name: "40 Hadith Nawawi", nameAr: "الأربعون النووية", hadithCount: 42 },
  qudsi: { name: "40 Hadith Qudsi", nameAr: "الأربعون القدسية", hadithCount: 40 },
};

const QURAN_LANG_ORDER = ["ar", "en", "ru", "az", "tr"] as const;
const HADITH_LANG_ORDER = ["ar", "en", "ru", "tr"] as const;

const H2 = "mt-12 mb-3 text-2xl font-semibold tracking-tight text-foreground";
const TABLE_WRAP =
  "mt-4 overflow-x-auto rounded-md border border-border";
const TABLE = "w-full text-left text-sm";
const TH = "bg-muted/60 px-3 py-2 font-semibold text-foreground border-b border-border whitespace-nowrap";
const TD = "px-3 py-2 align-top border-b border-border/60";
const CODE =
  "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground/90";
const PILL_FULL =
  "inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success";
const PILL_META =
  "inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning";

function RedistributePill({ entry }: { entry: TranslationCatalogEntry }) {
  if (entry.redistribute === "full") {
    return <span className={PILL_FULL}>Full text</span>;
  }
  return <span className={PILL_META}>Metadata only</span>;
}

function DownloadCell({ href }: { href: string }) {
  return (
    <a
      className="inline-flex items-center gap-1 font-mono text-xs text-primary underline hover:no-underline"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download
    >
      {href}
    </a>
  );
}

function structuredData() {
  const distributions = [];
  for (const lang of QURAN_LANG_ORDER) {
    const e = QURAN_TRANSLATION_CATALOG[lang];
    if (!e) continue;
    distributions.push({
      "@type": "DataDownload",
      name: `Quran (${LANG_NAMES[lang] ?? lang}) — ${e.attribution}`,
      encodingFormat: "application/json",
      contentUrl: `${SITE_URL}/api/v1/translations/quran/${lang}`,
      inLanguage: lang,
    });
  }
  for (const slug of HADITH_COLLECTION_SLUGS) {
    for (const lang of HADITH_LANG_ORDER) {
      const e = HADITH_TRANSLATION_CATALOG[`${slug}:${lang}`];
      if (!e) continue;
      distributions.push({
        "@type": "DataDownload",
        name: `${COLLECTION_DISPLAY[slug].name} (${LANG_NAMES[lang] ?? lang}) — ${e.attribution}`,
        encodingFormat: "application/json",
        contentUrl: `${SITE_URL}/api/v1/translations/hadith/${slug}/${lang}`,
        inLanguage: lang,
      });
    }
  }
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "i-muslim Quran and Hadith translation downloads",
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/downloads`,
    keywords: [
      "Quran",
      "Hadith",
      "Islamic data",
      "Bukhari",
      "Muslim",
      "Abu Dawud",
      "Tirmidhi",
      "Nasa'i",
      "Ibn Majah",
      "Muwatta Malik",
      "Nawawi 40",
      "Qudsi 40",
      "Saheeh International",
      "Elmir Kuliev",
      "Diyanet",
    ],
    creator: { "@type": "Organization", name: "i-muslim", url: SITE_URL },
    license: `${SITE_URL}/downloads#licence`,
    isAccessibleForFree: true,
    distribution: distributions,
  };
}

export default function DownloadsPage() {
  const totalDownloads =
    Object.keys(QURAN_TRANSLATION_CATALOG).length +
    Object.keys(HADITH_TRANSLATION_CATALOG).length;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
      />

      <header className="mb-10 border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Open data
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Free Quran and Hadith translation downloads
        </h1>
        <p className="mt-3 text-base text-foreground/90 leading-relaxed">
          The Quran and the nine major Hadith collections — Bukhari, Muslim,
          Abu Dawud, Tirmidhi, Nasa&apos;i, Ibn Majah, Muwatta Malik, 40 Hadith
          Nawawi, 40 Hadith Qudsi — as <strong>plain JSON</strong>, served from{" "}
          <code className={CODE}>/api/v1/translations/*</code>. No API key. CORS
          open to every origin. 1-hour CDN cache. {totalDownloads} downloads
          listed below.
        </p>
        <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
          Each row lists the upstream source, the licence we are confident
          governs it, and whether our endpoint returns the text itself or
          metadata only.{" "}
          <a className="underline" href="#licence">
            Read the licence model
          </a>{" "}
          before you redistribute.
        </p>
      </header>

      <nav aria-label="On this page" className="mb-10 rounded-md border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold text-foreground">On this page</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          <li><a className="underline" href="#quran">Quran translations</a></li>
          <li><a className="underline" href="#hadith">Hadith collections</a></li>
          <li><a className="underline" href="#how">How to use the data</a></li>
          <li><a className="underline" href="#licence">Licence model</a></li>
          <li><a className="underline" href="#contribute">Contribute or correct</a></li>
          <li><a className="underline" href="#changes">Versioning</a></li>
        </ul>
      </nav>

      <h2 id="quran" className={H2}>
        Quran translations
      </h2>
      <p className="text-sm text-foreground/80 leading-relaxed">
        Every entry covers all 114 surahs (6,236 ayahs). Arabic ships the
        Uthmani mushaf from quran.com in full. Modern translations are
        translator-copyrighted — we expose the provenance metadata so you can
        fetch the text directly from the upstream source.
      </p>
      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>Language</th>
              <th className={TH}>Attribution</th>
              <th className={TH}>Licence</th>
              <th className={TH}>Returns</th>
              <th className={TH}>Download (JSON)</th>
            </tr>
          </thead>
          <tbody>
            {QURAN_LANG_ORDER.map((lang) => {
              const entry = QURAN_TRANSLATION_CATALOG[lang];
              if (!entry) return null;
              return (
                <tr key={lang}>
                  <td className={TD}>
                    <div className="font-semibold text-foreground">
                      {LANG_NAMES[lang] ?? lang}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <code className={CODE}>{lang}</code>
                    </div>
                  </td>
                  <td className={TD}>{entry.attribution}</td>
                  <td className={TD}>
                    <div>{entry.license}</div>
                    {entry.sourceUrl && (
                      <a
                        className="mt-1 inline-block text-xs text-muted-foreground underline"
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        upstream source ↗
                      </a>
                    )}
                  </td>
                  <td className={TD}>
                    <RedistributePill entry={entry} />
                  </td>
                  <td className={TD}>
                    <DownloadCell href={`/api/v1/translations/quran/${lang}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 id="hadith" className={H2}>
        Hadith collections
      </h2>
      <p className="text-sm text-foreground/80 leading-relaxed">
        Nine collections, four languages where coverage exists. Arabic editions
        are public-domain classical text (aggregated by
        fawazahmed0/hadith-api); modern translations are translator-copyrighted
        and metadata-only here.
      </p>

      {HADITH_COLLECTION_SLUGS.map((slug) => {
        const display = COLLECTION_DISPLAY[slug];
        return (
          <section key={slug} className="mt-8">
            <h3 className="text-lg font-semibold text-foreground">
              {display.name}{" "}
              <span dir="rtl" className="font-arabic text-base text-muted-foreground">
                ({display.nameAr})
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              ≈ {display.hadithCount.toLocaleString()} entries
            </p>
            <div className={TABLE_WRAP}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Language</th>
                    <th className={TH}>Attribution</th>
                    <th className={TH}>Licence</th>
                    <th className={TH}>Returns</th>
                    <th className={TH}>Download (JSON)</th>
                  </tr>
                </thead>
                <tbody>
                  {HADITH_LANG_ORDER.map((lang) => {
                    const entry = HADITH_TRANSLATION_CATALOG[`${slug}:${lang}`];
                    if (!entry) return null;
                    return (
                      <tr key={`${slug}:${lang}`}>
                        <td className={TD}>
                          <div className="font-semibold text-foreground">
                            {LANG_NAMES[lang] ?? lang}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <code className={CODE}>{lang}</code>
                          </div>
                        </td>
                        <td className={TD}>{entry.attribution}</td>
                        <td className={TD}>
                          <div>{entry.license}</div>
                          {entry.sourceUrl && (
                            <a
                              className="mt-1 inline-block text-xs text-muted-foreground underline"
                              href={entry.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              upstream source ↗
                            </a>
                          )}
                        </td>
                        <td className={TD}>
                          <RedistributePill entry={entry} />
                        </td>
                        <td className={TD}>
                          <DownloadCell
                            href={`/api/v1/translations/hadith/${slug}/${lang}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <h2 id="how" className={H2}>
        How to use the data
      </h2>
      <p className="text-sm text-foreground/90 leading-relaxed">
        Every endpoint returns a single JSON object. The envelope carries the
        provenance fields (<code className={CODE}>attribution</code>,{" "}
        <code className={CODE}>license</code>,{" "}
        <code className={CODE}>source_url</code>,{" "}
        <code className={CODE}>redistribute</code>,{" "}
        <code className={CODE}>notice</code>), then a{" "}
        <code className={CODE}>count</code> and an{" "}
        <code className={CODE}>items</code> array. When the licence forbids
        redistribution, each item&apos;s <code className={CODE}>text</code> is{" "}
        <code className={CODE}>null</code> — fetch from{" "}
        <code className={CODE}>source_url</code> instead.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs text-foreground/90">
{`# discover everything
curl https://i-muslim.com/api/v1/translations

# full text — Arabic Quran (public domain)
curl https://i-muslim.com/api/v1/translations/quran/ar

# metadata only — Saheeh International (translator copyright)
curl https://i-muslim.com/api/v1/translations/quran/en

# full text — Bukhari Arabic (classical text)
curl https://i-muslim.com/api/v1/translations/hadith/bukhari/ar

# single surah for lighter payloads
curl https://i-muslim.com/api/v1/translations/quran/ar/1`}
      </pre>
      <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
        Need a richer surface (per-ayah, per-hadith, with translations as
        query parameters, plus write access for your own translations)? See the{" "}
        <Link className="underline" href="/developers">
          Developer API docs
        </Link>{" "}
        — those endpoints require an API key but cover the same data at a
        finer grain.
      </p>

      <h2 id="licence" className={H2}>
        Licence model
      </h2>
      <p className="text-sm text-foreground/90 leading-relaxed">
        There is no single licence covering the whole dataset. Each translation
        is governed by the licence of its <strong>original publisher</strong>,
        and the API response carries that licence verbatim. Two redistribute
        modes:
      </p>
      <ul className="mt-3 space-y-2 text-sm text-foreground/90 leading-relaxed">
        <li>
          <strong>
            <span className={PILL_FULL}>Full text</span>
          </strong>{" "}
          — the API returns text verbatim. Currently the <strong>Arabic
          Quran (Uthmani mushaf)</strong> and the <strong>Arabic Hadith
          editions</strong> — both classical, public-domain text.
        </li>
        <li>
          <strong>
            <span className={PILL_META}>Metadata only</span>
          </strong>{" "}
          — the API returns the attribution, licence label and upstream URL,
          but <code className={CODE}>text</code> is{" "}
          <code className={CODE}>null</code>. Applies to every modern
          translator-authored translation (Saheeh International, Kuliev,
          Musayev, Diyanet, and the fawazahmed0-aggregated Hadith
          translations) until we have an open-licence grant on file. Fetch the
          text directly from <code className={CODE}>source_url</code>.
        </li>
      </ul>
      <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
        We default to <em>metadata only</em> whenever a translation&apos;s
        redistribution licence is unclear. If you hold the copyright on one of
        these translations and want to release it under an open licence so the
        text can ship in full, please{" "}
        <Link
          className="underline"
          href="/contact?subject=Translation+licence+grant"
        >
          get in touch
        </Link>{" "}
        — we&apos;d love to.
      </p>

      <h2 id="contribute" className={H2}>
        Contribute or correct a translation
      </h2>
      <p className="text-sm text-foreground/90 leading-relaxed">
        Spotted an error? Want to contribute a translation you wrote yourself
        and own? Send it through the contact form with subject{" "}
        <em>&ldquo;Translation contribution&rdquo;</em> — include the diff, the
        source you took the text from, and the licence you&apos;re releasing
        your contribution under. We&apos;ll review and merge.
      </p>
      <p className="mt-3">
        <Link
          href="/contact?subject=Translation+contribution"
          className="inline-flex items-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Open contribution form →
        </Link>
      </p>

      <h2 id="changes" className={H2}>
        Versioning
      </h2>
      <p className="text-sm text-foreground/90 leading-relaxed">
        These downloads sit under <code className={CODE}>/api/v1/</code> — the
        stable surface. Any breaking change to the JSON shape ships under{" "}
        <code className={CODE}>v2</code>; we&apos;ll keep{" "}
        <code className={CODE}>v1</code> running for at least 12 months after.
        Adding a new translation, a new licence row, or flipping a row from
        metadata-only to full text is <em>not</em> a breaking change.
      </p>
    </div>
  );
}
