import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import {
  QURAN_TRANSLATION_CATALOG,
  HADITH_TRANSLATION_CATALOG,
  HADITH_COLLECTION_SLUGS,
  IMUSLIM_AUTHORED,
  type TranslationCatalogEntry,
} from "@/lib/translations/catalog";
import { getContentTranslationStats } from "@/lib/admin/data/content-translation-stats";

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
  "Download the Quran and the major Hadith collections (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Malik, Nawawi 40, Qudsi 40) as JSON. Tens of thousands of Hadith translations authored by i-muslim are released under CC0; Arabic originals are public-domain; modern third-party translations carry full provenance and the upstream URL. Free, no API key, CORS-open, machine-readable.";

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
    "CC0 hadith translation",
    "open hadith dataset",
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
  { name: string; nameAr: string }
> = {
  bukhari: { name: "Sahih al-Bukhari", nameAr: "صحيح البخاري" },
  muslim: { name: "Sahih Muslim", nameAr: "صحيح مسلم" },
  abudawud: { name: "Sunan Abu Dawud", nameAr: "سنن أبي داود" },
  tirmidhi: { name: "Jami` at-Tirmidhi", nameAr: "جامع الترمذي" },
  nasai: { name: "Sunan an-Nasa'i", nameAr: "سنن النسائي" },
  ibnmajah: { name: "Sunan Ibn Majah", nameAr: "سنن ابن ماجه" },
  malik: { name: "Muwatta Malik", nameAr: "موطأ مالك" },
  nawawi: { name: "40 Hadith Nawawi", nameAr: "الأربعون النووية" },
  qudsi: { name: "40 Hadith Qudsi", nameAr: "الأربعون القدسية" },
};

const QURAN_LANG_ORDER = ["ar", "en", "ru", "az", "tr"] as const;
const HADITH_LANG_ORDER = ["ar", "en", "ru", "tr"] as const;

const H2 = "mt-12 mb-3 text-2xl font-semibold tracking-tight text-foreground";
const TABLE_WRAP = "mt-4 overflow-x-auto rounded-md border border-border";
const TABLE = "w-full text-left text-sm";
const TH =
  "bg-muted/60 px-3 py-2 font-semibold text-foreground border-b border-border whitespace-nowrap";
const TD = "px-3 py-2 align-top border-b border-border/60";
const CODE =
  "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground/90";
const PILL_BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold";
const PILL_FULL = `${PILL_BASE} bg-success/15 text-success`;
const PILL_AUTHORED = `${PILL_BASE} bg-primary/15 text-primary`;
const PILL_META = `${PILL_BASE} bg-warning/15 text-warning`;

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

type HadithStatsForCollection = {
  total: number;
  perLang: Partial<Record<string, number>>;
  authoredPerLang: Partial<Record<string, number>>;
};

function structuredData(
  hadithStats: Record<string, HadithStatsForCollection>,
  authoredGrandTotal: number,
) {
  const distributions: Array<Record<string, unknown>> = [];
  for (const lang of QURAN_LANG_ORDER) {
    const e = QURAN_TRANSLATION_CATALOG[lang];
    if (!e) continue;
    distributions.push({
      "@type": "DataDownload",
      name: `Quran (${LANG_NAMES[lang] ?? lang}) — ${e.attribution}`,
      encodingFormat: "application/json",
      contentUrl: `${SITE_URL}/api/v1/translations/quran/${lang}`,
      inLanguage: lang,
      license: e.licenseUrl ?? undefined,
    });
  }
  for (const slug of HADITH_COLLECTION_SLUGS) {
    const stats = hadithStats[slug];
    for (const lang of HADITH_LANG_ORDER) {
      const e = HADITH_TRANSLATION_CATALOG[`${slug}:${lang}`];
      if (!e) continue;
      const authoredCount = stats?.authoredPerLang?.[lang] ?? 0;
      const totalForLang = stats?.perLang?.[lang] ?? 0;
      // Emit a CC0 authored-portion distribution whenever i-muslim has at
      // least one authored translation for this (collection, lang). Google
      // Dataset Search reads the per-distribution license field, so
      // surfacing CC0 here is what makes the dataset discoverable as open.
      if (lang !== "ar" && authoredCount > 0) {
        distributions.push({
          "@type": "DataDownload",
          name: `${COLLECTION_DISPLAY[slug].name} (${LANG_NAMES[lang] ?? lang}) — i-muslim authored portion`,
          description: `${authoredCount.toLocaleString()} hadith translations authored by i-muslim, released under CC0 1.0.`,
          encodingFormat: "application/json",
          contentUrl: `${SITE_URL}/api/v1/translations/hadith/${slug}/${lang}`,
          inLanguage: lang,
          license: IMUSLIM_AUTHORED.licenseUrl,
        });
      }
      // Always advertise the canonical full-language endpoint with its
      // upstream attribution — covers Arabic (full text) and the upstream
      // imported portion for non-Arabic langs.
      distributions.push({
        "@type": "DataDownload",
        name: `${COLLECTION_DISPLAY[slug].name} (${LANG_NAMES[lang] ?? lang}) — ${e.attribution}`,
        description:
          lang === "ar"
            ? `${totalForLang.toLocaleString()} hadiths, classical Arabic text (public domain).`
            : `Full payload covering ${totalForLang.toLocaleString()} hadiths; ${authoredCount.toLocaleString()} carry CC0-licensed text authored by i-muslim, the remainder are metadata-only (text=null) under the upstream licence.`,
        encodingFormat: "application/json",
        contentUrl: `${SITE_URL}/api/v1/translations/hadith/${slug}/${lang}`,
        inLanguage: lang,
        license: e.licenseUrl ?? undefined,
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
      "CC0",
      "i-muslim",
    ],
    creator: { "@type": "Organization", name: "i-muslim", url: SITE_URL },
    // Whole-dataset licence pointer goes to our explainer; per-distribution
    // licences above are what Dataset Search actually uses.
    license: `${SITE_URL}/downloads#licence`,
    isAccessibleForFree: true,
    distribution: distributions,
    ...(authoredGrandTotal > 0 && {
      // Surface the headline open-licensed count in description-adjacent text.
      // schema.org has no first-class field for "open subset count", so we
      // include it inside variableMeasured for indexer ingestion.
      variableMeasured: {
        "@type": "PropertyValue",
        name: "CC0 hadith translations authored by i-muslim",
        value: authoredGrandTotal,
      },
    }),
  };
}

export default async function DownloadsPage() {
  const stats = await getContentTranslationStats();

  // Sum authored hadith translations across every (collection, lang). This is
  // the headline "X authored by i-muslim under CC0" number on the page.
  let authoredGrandTotal = 0;
  for (const slug of HADITH_COLLECTION_SLUGS) {
    const bucket = stats.hadith.perCollection[slug];
    if (!bucket) continue;
    for (const lang of HADITH_LANG_ORDER) {
      if (lang === "ar") continue;
      authoredGrandTotal += bucket.authoredPerLang[lang] ?? 0;
    }
  }

  const hadithStatsForJsonLd: Record<string, HadithStatsForCollection> = {};
  for (const slug of HADITH_COLLECTION_SLUGS) {
    const bucket = stats.hadith.perCollection[slug];
    if (!bucket) continue;
    hadithStatsForJsonLd[slug] = {
      total: bucket.total,
      perLang: bucket.perLang,
      authoredPerLang: bucket.authoredPerLang,
    };
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData(hadithStatsForJsonLd, authoredGrandTotal)),
        }}
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
          Nawawi, 40 Hadith Qudsi — as <strong>plain JSON</strong>, served
          from <code className={CODE}>/api/v1/translations/*</code>. No API
          key. CORS open to every origin. 1-hour CDN cache.
        </p>
        {authoredGrandTotal > 0 && (
          <p className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground/90 leading-relaxed">
            <strong>{authoredGrandTotal.toLocaleString()} Hadith translations</strong>{" "}
            have been authored by i-muslim and are released under{" "}
            <a
              className="underline"
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              CC0 1.0 (public domain)
            </a>
            . The rest are mirrored from upstream sources and ship as metadata
            only (text <code className={CODE}>null</code>) until we have an
            open-licence grant on file —{" "}
            <a className="underline" href="#licence">
              read the licence model
            </a>
            .
          </p>
        )}
      </header>

      <nav
        aria-label="On this page"
        className="mb-10 rounded-md border border-border bg-muted/30 p-4 text-sm"
      >
        <p className="font-semibold text-foreground">On this page</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          <li>
            <a className="underline" href="#quran">
              Quran translations
            </a>
          </li>
          <li>
            <a className="underline" href="#hadith">
              Hadith collections
            </a>
          </li>
          <li>
            <a className="underline" href="#how">
              How to use the data
            </a>
          </li>
          <li>
            <a className="underline" href="#licence">
              Licence model
            </a>
          </li>
          <li>
            <a className="underline" href="#contribute">
              Contribute or correct
            </a>
          </li>
          <li>
            <a className="underline" href="#changes">
              Versioning
            </a>
          </li>
        </ul>
      </nav>

      <h2 id="quran" className={H2}>
        Quran translations
      </h2>
      <p className="text-sm text-foreground/80 leading-relaxed">
        Every entry covers all 114 surahs (6,236 ayahs). Arabic ships the
        Uthmani mushaf from quran.com in full. Modern Quran translations are
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
        are public-domain classical text. Non-Arabic translations split into{" "}
        <strong>i-muslim authored (CC0)</strong> and{" "}
        <strong>upstream mirrored (metadata only)</strong> — the response
        envelope tells you how many of each. Counts below come from the live
        Firestore tally.
      </p>

      {HADITH_COLLECTION_SLUGS.map((slug) => {
        const display = COLLECTION_DISPLAY[slug];
        const bucket = stats.hadith.perCollection[slug];
        const collectionTotal = bucket?.total ?? 0;
        return (
          <section key={slug} className="mt-8">
            <h3 className="text-lg font-semibold text-foreground">
              {display.name}{" "}
              <span
                dir="rtl"
                className="font-arabic text-base text-muted-foreground"
              >
                ({display.nameAr})
              </span>
            </h3>
            {collectionTotal > 0 && (
              <p className="text-xs text-muted-foreground">
                {collectionTotal.toLocaleString()} hadith entries
              </p>
            )}
            <div className={TABLE_WRAP}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Language</th>
                    <th className={TH}>Sources &amp; licences</th>
                    <th className={TH}>Counts</th>
                    <th className={TH}>Returns</th>
                    <th className={TH}>Download (JSON)</th>
                  </tr>
                </thead>
                <tbody>
                  {HADITH_LANG_ORDER.map((lang) => {
                    const entry = HADITH_TRANSLATION_CATALOG[`${slug}:${lang}`];
                    if (!entry) return null;
                    const totalForLang = bucket?.perLang?.[lang] ?? 0;
                    const authoredForLang =
                      bucket?.authoredPerLang?.[lang] ?? 0;
                    const importedForLang = Math.max(
                      0,
                      totalForLang - authoredForLang,
                    );
                    const isArabic = lang === "ar";
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
                        <td className={TD}>
                          {/* Authored (CC0) source row — only when i-muslim
                              has actually authored translations for this
                              (collection, lang). Hide otherwise to avoid
                              implying availability where there is none. */}
                          {!isArabic && authoredForLang > 0 && (
                            <div className="mb-2">
                              <div className="font-semibold text-foreground">
                                {IMUSLIM_AUTHORED.attribution}
                              </div>
                              <div className="text-xs text-foreground/80">
                                {IMUSLIM_AUTHORED.license}
                              </div>
                              <a
                                className="text-xs text-muted-foreground underline"
                                href={IMUSLIM_AUTHORED.licenseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                licence text ↗
                              </a>
                            </div>
                          )}
                          {/* Upstream / Arabic source row. */}
                          <div>
                            <div className="font-semibold text-foreground">
                              {entry.attribution}
                            </div>
                            <div className="text-xs text-foreground/80">
                              {entry.license}
                            </div>
                            {entry.sourceUrl && (
                              <a
                                className="text-xs text-muted-foreground underline"
                                href={entry.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                upstream source ↗
                              </a>
                            )}
                          </div>
                        </td>
                        <td className={TD}>
                          {isArabic ? (
                            <div className="text-xs text-foreground/80">
                              {totalForLang.toLocaleString()} entries
                            </div>
                          ) : (
                            <div className="space-y-1 text-xs text-foreground/80">
                              {authoredForLang > 0 && (
                                <div>
                                  <strong>
                                    {authoredForLang.toLocaleString()}
                                  </strong>{" "}
                                  authored (CC0)
                                </div>
                              )}
                              {importedForLang > 0 && (
                                <div>
                                  <strong>
                                    {importedForLang.toLocaleString()}
                                  </strong>{" "}
                                  upstream-mirrored
                                </div>
                              )}
                              {authoredForLang === 0 &&
                                importedForLang === 0 && (
                                  <div className="text-muted-foreground">
                                    no published translations yet
                                  </div>
                                )}
                            </div>
                          )}
                        </td>
                        <td className={TD}>
                          <div className="flex flex-col gap-1">
                            {isArabic && (
                              <RedistributePill entry={entry} />
                            )}
                            {!isArabic && authoredForLang > 0 && (
                              <span className={PILL_AUTHORED}>
                                Full text (CC0)
                              </span>
                            )}
                            {!isArabic && importedForLang > 0 && (
                              <span className={PILL_META}>Metadata only</span>
                            )}
                          </div>
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
        Every endpoint returns a single JSON object. For non-Arabic Hadith
        endpoints the envelope carries two licence stanzas under{" "}
        <code className={CODE}>sources.authored</code> and{" "}
        <code className={CODE}>sources.imported</code>, plus a per-item{" "}
        <code className={CODE}>source</code> tag so you can{" "}
        <code className={CODE}>filter(i =&gt; i.source === &quot;authored&quot;)</code>{" "}
        to keep only the CC0-licensed rows. Authored items return full text;
        upstream-mirrored items return{" "}
        <code className={CODE}>text: null</code> — fetch from{" "}
        <code className={CODE}>source_url</code> if you need them.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs text-foreground/90">
{`# discover everything
curl https://i-muslim.com/api/v1/translations

# full text — Arabic Quran (public domain)
curl https://i-muslim.com/api/v1/translations/quran/ar

# metadata only — Saheeh International (translator copyright)
curl https://i-muslim.com/api/v1/translations/quran/en

# CC0 (i-muslim authored) + metadata (upstream) — mixed envelope
curl https://i-muslim.com/api/v1/translations/hadith/bukhari/en \\
  | jq '.data.sources, (.data.items | map(select(.source == "authored")) | length)'

# full text — Bukhari Arabic (classical text)
curl https://i-muslim.com/api/v1/translations/hadith/bukhari/ar

# single surah for lighter payloads
curl https://i-muslim.com/api/v1/translations/quran/ar/1`}
      </pre>
      <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
        Need a richer surface (per-ayah, per-hadith, with translations as
        query parameters, plus write access for your own translations)? See
        the{" "}
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
        There is no single licence covering the whole dataset. Each item is
        governed by the licence of its original author, and the API response
        carries that licence verbatim. Three buckets:
      </p>
      <ul className="mt-3 space-y-2 text-sm text-foreground/90 leading-relaxed">
        <li>
          <strong>
            <span className={PILL_AUTHORED}>Full text (CC0)</span>
          </strong>{" "}
          — translations <strong>authored by i-muslim</strong> (flagged
          per-item with <code className={CODE}>editedTranslations[lang]</code>{" "}
          in our store). Released under{" "}
          <a
            className="underline"
            href="https://creativecommons.org/publicdomain/zero/1.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC0 1.0
          </a>
          : do anything, no attribution required.
        </li>
        <li>
          <strong>
            <span className={PILL_FULL}>Full text</span>
          </strong>{" "}
          — Arabic originals (the Uthmani Quran mushaf and the classical
          Arabic Hadith editions). Public-domain text, returned verbatim.
        </li>
        <li>
          <strong>
            <span className={PILL_META}>Metadata only</span>
          </strong>{" "}
          — translator-copyrighted modern translations (Saheeh International,
          Kuliev, Musayev, Diyanet for Quran; upstream sources like
          fawazahmed0/hadith-api for non-Arabic Hadith items we haven&apos;t
          re-authored). The API returns the attribution, licence label and
          upstream URL but <code className={CODE}>text</code> is{" "}
          <code className={CODE}>null</code>. Fetch the text from{" "}
          <code className={CODE}>source_url</code>.
        </li>
      </ul>
      <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
        We default to <em>metadata only</em> whenever a third-party
        translation&apos;s redistribution licence is unclear. If you hold the
        copyright on one of those translations and want to release it under an
        open licence,{" "}
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
        <em>&ldquo;Translation contribution&rdquo;</em> — include the diff,
        the source you took the text from, and the licence you&apos;re
        releasing your contribution under. We&apos;ll review and merge into
        the CC0-authored pool.
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
        Adding a new translation, flipping a row from metadata-only to full
        text, or growing the authored-CC0 count is <em>not</em> a breaking
        change.
      </p>
    </div>
  );
}
