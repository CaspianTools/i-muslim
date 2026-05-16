import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer API — i-muslim",
  description:
    "Public read/write HTTP API for prayer times, Qibla, Hijri dates, Quran, Hadith, and mosque data. Free, key-authenticated, browser-friendly.",
};

const H2 = "mt-12 mb-3 text-2xl font-semibold tracking-tight text-foreground";
const SUB = "mt-1 text-sm text-muted-foreground";
const CODE =
  "block whitespace-pre-wrap overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs text-foreground/90";
const INLINE =
  "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground/90";

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-10 border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Developer API · v1
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Build with i-muslim data
        </h1>
        <p className="mt-3 text-base text-foreground/90 leading-relaxed">
          A clean JSON API for the things every Islamic app needs: prayer times,
          Qibla direction, the Hijri calendar, mosque listings, the Quran, and the
          major Hadith collections — read and write. Free for community use, rate
          limited per key, no marketing tracking. Issue a key, drop in a fetch
          call, ship.
        </p>
      </header>

      <h2 className={H2}>What you can do</h2>
      <ul className="mt-3 space-y-2 text-sm text-foreground/90 leading-relaxed">
        <li>
          <strong>Read prayer times</strong> for any coordinates, date, calculation
          method, and madhab — calculated server-side with the canonical{" "}
          <code className={INLINE}>adhan</code> algorithm.
        </li>
        <li>
          <strong>Get the Qibla bearing</strong> from anywhere on Earth (great-circle
          to the Kaaba).
        </li>
        <li>
          <strong>Convert dates</strong> between Gregorian and Hijri (Umm al-Qura).
        </li>
        <li>
          <strong>Query mosques</strong> by location, country, city, or text — same
          dataset that powers the i-muslim mosque directory.
        </li>
        <li>
          <strong>Read the Quran</strong> with Arabic + translations in English,
          Russian, Azerbaijani, Turkish.
        </li>
        <li>
          <strong>Read Hadith</strong> from Bukhari, Muslim, Abu Dawud, Tirmidhi,
          Nasa&apos;i, Ibn Majah, Malik, Nawawi 40, and Qudsi 40.
        </li>
        <li>
          <strong>Publish translations</strong> — your translation pipeline can{" "}
          <code className={INLINE}>PUT</code> directly into our Quran and Hadith
          stores. Arabic original text stays read-only.
        </li>
      </ul>

      <h2 className={H2}>Getting a key</h2>
      <p className={SUB}>
        Email{" "}
        <a className="underline" href="mailto:fuad.jalilov@gmail.com">
          fuad.jalilov@gmail.com
        </a>{" "}
        with a one-sentence description of what you&apos;re building and which
        endpoints you need. Keys are issued manually during v1 and typically come
        back within 24 hours. Each key is scoped to a subset of resources
        (e.g. <code className={INLINE}>hadith</code>,{" "}
        <code className={INLINE}>prayer-times</code>) and a subset of permissions
        (<code className={INLINE}>read</code>, <code className={INLINE}>write</code>,{" "}
        <code className={INLINE}>delete</code>).
      </p>

      <h2 className={H2}>Quick start</h2>
      <p className={SUB}>Every request needs the <code className={INLINE}>X-API-Key</code> header. Here&apos;s the simplest possible request — Qibla bearing for London:</p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">curl</p>
      <code className={CODE}>{`curl -H "X-API-Key: im_live_..." \\
  "https://i-muslim.com/api/v1/qibla?lat=51.5074&lng=-0.1278"`}</code>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">JavaScript (Node 18+, browsers)</p>
      <code className={CODE}>{`const res = await fetch(
  "https://i-muslim.com/api/v1/qibla?lat=51.5074&lng=-0.1278",
  { headers: { "X-API-Key": process.env.IMUSLIM_API_KEY } },
);
const { data } = await res.json();
console.log(data.bearing); // → 118.99 degrees from north`}</code>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Python (requests)</p>
      <code className={CODE}>{`import os, requests
r = requests.get(
    "https://i-muslim.com/api/v1/qibla",
    params={"lat": 51.5074, "lng": -0.1278},
    headers={"X-API-Key": os.environ["IMUSLIM_API_KEY"]},
)
print(r.json()["data"]["bearing"])`}</code>

      <h2 className={H2}>Publishing a translation</h2>
      <p className={SUB}>
        With a <code className={INLINE}>write</code>-scope key, you can publish or
        update a translation for any hadith or Quranic ayah. The endpoint is
        idempotent — call it again with new text and it overwrites. Arabic
        (<code className={INLINE}>text_ar</code>) is never editable via API.
      </p>
      <code className={CODE}>{`curl -X PUT \\
  -H "X-API-Key: im_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"text": "The deeds are only by intentions..."}' \\
  "https://i-muslim.com/api/v1/hadith/collections/bukhari/hadiths/1/translations/en"`}</code>
      <p className="mt-3 text-sm text-foreground/90 leading-relaxed">
        Every write is recorded in our audit log with your key id, your key name,
        and a before/after snapshot. If you push a translation that turns out to
        be wrong, we can roll it back.
      </p>

      <h2 className={H2}>Endpoints</h2>

      <h3 className="mt-6 mb-2 text-base font-semibold text-foreground">Read (GET)</h3>
      <p className={SUB}>
        Browser-callable: <code className={INLINE}>Access-Control-Allow-Origin: *</code>{" "}
        is set on every response. Safe to call directly from frontend code if your
        key is read-only.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <Endpoint method="GET" path="/api/v1/prayer-times" desc="Five daily prayer times for coordinates + date + method + madhab." />
        <Endpoint method="GET" path="/api/v1/qibla" desc="Qibla bearing (degrees from north) for coordinates." />
        <Endpoint method="GET" path="/api/v1/hijri" desc="Gregorian ↔ Hijri conversion for a date (default today)." />
        <Endpoint method="GET" path="/api/v1/mosques" desc="List published mosques. Filters: near=lat,lng[,radiusKm], country, city, q, limit." />
        <Endpoint method="GET" path="/api/v1/mosques/{slug}" desc="Single mosque by slug." />
        <Endpoint method="GET" path="/api/v1/quran/surahs" desc="All 114 surahs (id, names, count)." />
        <Endpoint method="GET" path="/api/v1/quran/surahs/{surah}/ayahs" desc="All ayahs of a surah. Optional ?translations=en,ru,tr." />
        <Endpoint method="GET" path="/api/v1/quran/surahs/{surah}/ayahs/{ayah}" desc="Single ayah." />
        <Endpoint method="GET" path="/api/v1/hadith/collections" desc="All hadith collections (slug, name, total)." />
        <Endpoint method="GET" path="/api/v1/hadith/collections/{id}/hadiths" desc="Paginated hadiths within a collection. ?limit=, ?startAfter= for cursor." />
        <Endpoint method="GET" path="/api/v1/hadith/collections/{id}/hadiths/{number}" desc="Single hadith with Arabic + translations." />
      </ul>

      <h3 className="mt-8 mb-2 text-base font-semibold text-foreground">Write (PUT / PATCH / POST)</h3>
      <p className={SUB}>
        <strong>Server-side only.</strong> Write endpoints intentionally don&apos;t set
        CORS headers — call them from your backend so the key never lands in a
        browser. Requires <code className={INLINE}>write</code> permission on the key.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        <Endpoint method="PUT" path="/api/v1/hadith/collections/{id}/hadiths/{number}/translations/{locale}" desc="Upsert a hadith translation. Body: { text }." />
        <Endpoint method="PATCH" path="/api/v1/hadith/collections/{id}/hadiths/{number}" desc="Patch hadith metadata: narrator, grade, tags, notes, published." />
        <Endpoint method="PUT" path="/api/v1/quran/surahs/{surah}/ayahs/{ayah}/translations/{locale}" desc="Upsert a Quran ayah translation. Body: { text }." />
        <Endpoint method="PATCH" path="/api/v1/quran/surahs/{surah}/ayahs/{ayah}" desc="Patch ayah metadata: tags, notes, published." />
        <Endpoint method="POST" path="/api/v1/mosques" desc="Submit a new mosque for moderation. Body: nameEn, addressLine1, city, country, submitterEmail, [nameAr, denomination, phone, website, email, description, languages]." />
      </ul>

      <h2 className={H2}>Authentication</h2>
      <p className={SUB}>
        Send your key in the <code className={INLINE}>X-API-Key</code> header on every
        request. Keys look like <code className={INLINE}>im_live_AbCd…</code> and are
        shown <strong>exactly once</strong> when issued — store them in your secrets
        manager (Vercel env vars, AWS Secrets Manager, GitHub Actions secrets, etc.).
        We only keep a SHA-256 hash on our side, so we cannot recover a lost key —
        ask for a new one.
      </p>

      <h2 className={H2}>Rate limits</h2>
      <p className={SUB}>
        <strong>100 requests per minute, per key.</strong> Every response carries
        three headers so you can self-throttle:
      </p>
      <code className={CODE}>{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1747234260`}</code>
      <p className={SUB}>
        When you exceed the limit you&apos;ll get <code className={INLINE}>429 Too Many Requests</code>{" "}
        with error code <code className={INLINE}>RATE_LIMITED</code>. Wait for the
        reset timestamp, or contact us if you need a higher cap for a legitimate
        use case.
      </p>

      <h2 className={H2}>Response shape</h2>
      <code className={CODE}>{`// Success
{ "data": { "bearing": 118.99, "origin": {...}, "kaaba": {...} } }

// Error
{ "error": { "code": "INVALID_API_KEY", "message": "API key not found or revoked" } }`}</code>

      <h2 className={H2}>Error codes</h2>
      <ul className="mt-3 space-y-1 text-sm text-foreground/90">
        <li><code className={INLINE}>MISSING_API_KEY</code> (401) — no <code className={INLINE}>X-API-Key</code> header sent.</li>
        <li><code className={INLINE}>INVALID_API_KEY</code> (401) — key not recognized or revoked.</li>
        <li><code className={INLINE}>EXPIRED_API_KEY</code> (401) — key was issued with an expiration date that has passed.</li>
        <li><code className={INLINE}>INSUFFICIENT_SCOPE</code> (403) — your key doesn&apos;t cover this resource type.</li>
        <li><code className={INLINE}>INSUFFICIENT_PERMISSION</code> (403) — read-only key trying to write, etc.</li>
        <li><code className={INLINE}>FORBIDDEN_LOCALE</code> (403) — you tried to write Arabic; it&apos;s the sacred original and read-only via API.</li>
        <li><code className={INLINE}>VALIDATION_ERROR</code> (400) — bad query string or body.</li>
        <li><code className={INLINE}>INVALID_JSON</code> (400) — body wasn&apos;t valid JSON.</li>
        <li><code className={INLINE}>NOT_FOUND</code> (404) — resource doesn&apos;t exist.</li>
        <li><code className={INLINE}>RATE_LIMITED</code> (429) — over 100 req/min on this key.</li>
      </ul>

      <h2 className={H2}>Stability & versioning</h2>
      <p className={SUB}>
        <code className={INLINE}>v1</code> is the stable surface. Any breaking change
        ships as <code className={INLINE}>v2</code> on a new path; we&apos;ll keep{" "}
        <code className={INLINE}>v1</code> running for at least 12 months after{" "}
        <code className={INLINE}>v2</code> launches.
      </p>

      <h2 className={H2}>Attribution & ethics</h2>
      <p className={SUB}>
        Quran and Hadith are sacred — please render them faithfully, don&apos;t
        paraphrase, and don&apos;t silently truncate. If you publish translations
        you authored, please make sure you have the right to do so. If you spot a
        translation error in our data, let us know and we&apos;ll roll it back.
      </p>

      <h2 className={H2}>Contact</h2>
      <p className={SUB}>
        Questions, bug reports, or higher-quota requests:{" "}
        <a className="underline" href="mailto:fuad.jalilov@gmail.com">
          fuad.jalilov@gmail.com
        </a>
        .
      </p>
    </div>
  );
}

function Endpoint({
  method,
  path,
  desc,
}: {
  method: string;
  path: string;
  desc: string;
}) {
  const color =
    method === "GET"
      ? "bg-success/15 text-success"
      : method === "DELETE"
        ? "bg-danger/15 text-danger"
        : "bg-warning/15 text-warning";
  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${color}`}>
          {method}
        </span>
        <code className="break-all font-mono text-xs text-foreground">{path}</code>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </li>
  );
}
