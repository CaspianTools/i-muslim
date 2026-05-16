import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer API",
  description:
    "Public read/write API for i-muslim. Prayer times, Qibla, Hijri, Quran, Hadith, Mosques. Issue an API key on request.",
};

const SECTION_HEAD = "mt-10 mb-3 text-xl font-semibold tracking-tight text-foreground";
const SECTION_SUB = "mt-2 text-sm text-muted-foreground";
const CODE_BLOCK =
  "block whitespace-pre-wrap rounded-md border border-border bg-muted p-3 font-mono text-xs text-foreground/90";

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Developer API
        </h1>
        <p className="mt-2 text-muted-foreground">
          Public HTTP API to read prayer times, Qibla, Hijri dates, Quran, Hadith, and
          mosque data, and to publish Quran/Hadith translations.
        </p>
      </header>

      <p className="text-foreground/90">
        The API is JSON-only, versioned at <code>/api/v1</code>, and authenticated with
        an <code>X-API-Key</code> header. To request a key, email{" "}
        <a className="underline" href="mailto:fuad.jalilov@gmail.com">
          fuad.jalilov@gmail.com
        </a>{" "}
        with a short description of your use case. Keys are issued manually for v1.
      </p>

      <h2 className={SECTION_HEAD}>Authentication</h2>
      <p className={SECTION_SUB}>
        Every request must include the <code>X-API-Key</code> header. Keys look like{" "}
        <code>im_live_…</code>. Treat them like passwords — server-side only for any
        write operations.
      </p>
      <code className={CODE_BLOCK}>
        {`curl -H "X-API-Key: im_live_..." https://i-muslim.app/api/v1/qibla?lat=51.5\\&lng=0.1`}
      </code>

      <h2 className={SECTION_HEAD}>CORS</h2>
      <p className={SECTION_SUB}>
        <strong>GET endpoints</strong> are browser-callable from any origin — build
        embeddable widgets directly in frontend code. <strong>Write endpoints</strong>{" "}
        (POST/PUT/PATCH) do not set CORS headers; call them from your backend so the
        key never lands in the browser.
      </p>

      <h2 className={SECTION_HEAD}>Rate limits</h2>
      <p className={SECTION_SUB}>
        100 requests per minute, per key. Every response carries{" "}
        <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, and{" "}
        <code>X-RateLimit-Reset</code> headers. Over the limit you get <code>429</code>{" "}
        with code <code>RATE_LIMITED</code>.
      </p>

      <h2 className={SECTION_HEAD}>Error envelope</h2>
      <code className={CODE_BLOCK}>{`{
  "error": { "code": "INVALID_API_KEY", "message": "API key not found or revoked" }
}`}</code>
      <p className={SECTION_SUB}>
        Codes: <code>MISSING_API_KEY</code>, <code>INVALID_API_KEY</code>,{" "}
        <code>EXPIRED_API_KEY</code>, <code>INSUFFICIENT_SCOPE</code>,{" "}
        <code>INSUFFICIENT_PERMISSION</code>, <code>RATE_LIMITED</code>,{" "}
        <code>VALIDATION_ERROR</code>, <code>FORBIDDEN_LOCALE</code>,{" "}
        <code>INVALID_JSON</code>, <code>NOT_FOUND</code>.
      </p>

      <h2 className={SECTION_HEAD}>Scopes & permissions</h2>
      <p className={SECTION_SUB}>
        Each key is issued with a set of scopes (<code>prayer-times</code>,{" "}
        <code>qibla</code>, <code>hijri</code>, <code>mosques</code>,{" "}
        <code>quran</code>, <code>hadith</code>, or <code>*</code> for all) and
        permissions (<code>read</code>, <code>write</code>, <code>delete</code>).
      </p>

      <h2 className={SECTION_HEAD}>Read endpoints</h2>
      <ul className="mt-3 space-y-3 text-sm">
        <Endpoint
          method="GET"
          path="/api/v1/prayer-times"
          desc="Prayer times for coordinates + date + method + madhab."
          example={`/api/v1/prayer-times?lat=51.5\\&lng=0.1\\&method=MuslimWorldLeague\\&madhab=shafi\\&date=2026-05-16\\&timezone=UTC`}
        />
        <Endpoint
          method="GET"
          path="/api/v1/qibla"
          desc="Qibla bearing (degrees from north) for coordinates."
          example={`/api/v1/qibla?lat=51.5\\&lng=0.1`}
        />
        <Endpoint
          method="GET"
          path="/api/v1/hijri"
          desc="Hijri date for a Gregorian date (default today)."
          example={`/api/v1/hijri?date=2026-05-16`}
        />
        <Endpoint
          method="GET"
          path="/api/v1/mosques"
          desc="List published mosques. Filters: near=lat,lng[,radiusKm], country, city, q, limit."
          example={`/api/v1/mosques?near=51.5,0.1,10\\&limit=10`}
        />
        <Endpoint
          method="GET"
          path="/api/v1/mosques/{slug}"
          desc="Single mosque by slug."
        />
        <Endpoint
          method="GET"
          path="/api/v1/quran/surahs"
          desc="All 114 surahs (id, names, count)."
        />
        <Endpoint
          method="GET"
          path="/api/v1/quran/surahs/{surah}/ayahs"
          desc="All ayahs of a surah. Optional ?translations=en,ru,tr."
        />
        <Endpoint
          method="GET"
          path="/api/v1/quran/surahs/{surah}/ayahs/{ayah}"
          desc="Single ayah."
        />
        <Endpoint
          method="GET"
          path="/api/v1/hadith/collections"
          desc="All hadith collections (slug, name, total)."
        />
        <Endpoint
          method="GET"
          path="/api/v1/hadith/collections/{id}/hadiths"
          desc="Paginated hadiths within a collection. ?limit=, ?startAfter= for cursor."
        />
        <Endpoint
          method="GET"
          path="/api/v1/hadith/collections/{id}/hadiths/{number}"
          desc="Single hadith."
        />
      </ul>

      <h2 className={SECTION_HEAD}>Write endpoints</h2>
      <p className={SECTION_SUB}>
        Require <code>write</code> permission. Arabic original text (<code>text_ar</code>)
        is read-only and cannot be modified via API — only translations and metadata.
        Every write is recorded in the audit log.
      </p>
      <ul className="mt-3 space-y-3 text-sm">
        <Endpoint
          method="PUT"
          path="/api/v1/hadith/collections/{id}/hadiths/{number}/translations/{locale}"
          desc="Upsert a hadith translation. Body: { text }."
          example={`curl -X PUT -H "X-API-Key: im_live_..." -H "Content-Type: application/json" \\
  -d '{"text":"Actions are by intention..."}' \\
  https://i-muslim.app/api/v1/hadith/collections/bukhari/hadiths/1/translations/en`}
        />
        <Endpoint
          method="PATCH"
          path="/api/v1/hadith/collections/{id}/hadiths/{number}"
          desc="Patch hadith metadata: narrator, grade, tags, notes, published."
        />
        <Endpoint
          method="PUT"
          path="/api/v1/quran/surahs/{surah}/ayahs/{ayah}/translations/{locale}"
          desc="Upsert a Quran ayah translation. Body: { text }."
        />
        <Endpoint
          method="PATCH"
          path="/api/v1/quran/surahs/{surah}/ayahs/{ayah}"
          desc="Patch ayah metadata: tags, notes, published."
        />
        <Endpoint
          method="POST"
          path="/api/v1/mosques"
          desc="Submit a new mosque for moderation. Body fields: nameEn, addressLine1, city, country, submitterEmail, [nameAr, denomination, phone, website, email, description, languages]."
        />
      </ul>

      <h2 className={SECTION_HEAD}>Versioning</h2>
      <p className={SECTION_SUB}>
        <code>v1</code> is the only stable version. Breaking changes will ship as{" "}
        <code>v2</code> at a new path. We&rsquo;ll keep <code>v1</code> running for at
        least 12 months after <code>v2</code> ships.
      </p>
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
  example,
}: {
  method: string;
  path: string;
  desc: string;
  example?: string;
}) {
  const color =
    method === "GET"
      ? "bg-success/10 text-success"
      : method === "POST"
        ? "bg-warning/10 text-warning"
        : method === "PUT"
          ? "bg-warning/10 text-warning"
          : method === "PATCH"
            ? "bg-warning/10 text-warning"
            : "bg-danger/10 text-danger";
  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 font-mono text-xs ${color}`}>{method}</span>
        <code className="font-mono text-xs text-foreground">{path}</code>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      {example && (
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-[11px] text-foreground/90">
          {example}
        </pre>
      )}
    </li>
  );
}
