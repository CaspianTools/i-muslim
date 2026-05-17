import type { ApiPermission, ApiScope } from "@/types/api";

export type ConcreteScope = Exclude<ApiScope, "*">;

export interface EndpointEntry {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  scope: ConcreteScope;
  permission: ApiPermission;
  desc: string;
  cors: boolean;
}

export const ENDPOINTS: EndpointEntry[] = [
  // ── Prayer / Qibla / Hijri (math, read-only) ───────────────────────────
  {
    method: "GET",
    path: "/api/v1/prayer-times",
    scope: "prayer-times",
    permission: "read",
    desc: "Five daily prayer times for ?lat&lng&date&method&madhab&timezone.",
    cors: true,
  },
  {
    method: "GET",
    path: "/api/v1/qibla",
    scope: "qibla",
    permission: "read",
    desc: "Qibla bearing (degrees from north) for ?lat&lng.",
    cors: true,
  },
  {
    method: "GET",
    path: "/api/v1/hijri",
    scope: "hijri",
    permission: "read",
    desc: "Gregorian ↔ Hijri conversion. Default today.",
    cors: true,
  },

  // ── Mosques ────────────────────────────────────────────────────────────
  {
    method: "GET",
    path: "/api/v1/mosques",
    scope: "mosques",
    permission: "read",
    desc: "List published mosques. ?near=lat,lng[,radiusKm]&country&city&q&limit.",
    cors: true,
  },
  {
    method: "GET",
    path: "/api/v1/mosques/{slug}",
    scope: "mosques",
    permission: "read",
    desc: "Single mosque by slug.",
    cors: true,
  },
  {
    method: "POST",
    path: "/api/v1/mosques",
    scope: "mosques",
    permission: "write",
    desc: "Submit new mosque (lands in moderation queue).",
    cors: false,
  },

  // ── Quran ──────────────────────────────────────────────────────────────
  {
    method: "GET",
    path: "/api/v1/quran/surahs",
    scope: "quran",
    permission: "read",
    desc: "All 114 surahs (id, names, ayah count).",
    cors: true,
  },
  {
    method: "GET",
    path: "/api/v1/quran/surahs/{surah}/ayahs",
    scope: "quran",
    permission: "read",
    desc: "All ayahs of a surah. ?translations=en,ru,tr.",
    cors: true,
  },
  {
    method: "GET",
    path: "/api/v1/quran/surahs/{surah}/ayahs/{ayah}",
    scope: "quran",
    permission: "read",
    desc: "Single ayah.",
    cors: true,
  },
  {
    method: "PUT",
    path: "/api/v1/quran/surahs/{surah}/ayahs/{ayah}/translations/{locale}",
    scope: "quran",
    permission: "write",
    desc: "Upsert a Quran ayah translation. Body: { text }.",
    cors: false,
  },
  {
    method: "PATCH",
    path: "/api/v1/quran/surahs/{surah}/ayahs/{ayah}",
    scope: "quran",
    permission: "write",
    desc: "Patch ayah metadata: tags, notes, published.",
    cors: false,
  },

  // ── Hadith ─────────────────────────────────────────────────────────────
  {
    method: "GET",
    path: "/api/v1/hadith/collections",
    scope: "hadith",
    permission: "read",
    desc: "All hadith collections.",
    cors: true,
  },
  {
    method: "GET",
    path: "/api/v1/hadith/collections/{id}",
    scope: "hadith",
    permission: "read",
    desc: "Single collection (books, total).",
    cors: true,
  },
  {
    method: "GET",
    path: "/api/v1/hadith/collections/{id}/hadiths",
    scope: "hadith",
    permission: "read",
    desc: "Paginated hadiths within a collection. ?limit&startAfter.",
    cors: true,
  },
  {
    method: "GET",
    path: "/api/v1/hadith/collections/{id}/hadiths/{number}",
    scope: "hadith",
    permission: "read",
    desc: "Single hadith with Arabic + translations.",
    cors: true,
  },
  {
    method: "PUT",
    path: "/api/v1/hadith/collections/{id}/hadiths/{number}/translations/{locale}",
    scope: "hadith",
    permission: "write",
    desc: "Upsert a hadith translation. Body: { text }.",
    cors: false,
  },
  {
    method: "PATCH",
    path: "/api/v1/hadith/collections/{id}/hadiths/{number}",
    scope: "hadith",
    permission: "write",
    desc: "Patch hadith metadata: narrator, grade, tags, notes, published.",
    cors: false,
  },
];

export function endpointsForKey(
  scopes: ApiScope[],
  permissions: ApiPermission[],
): EndpointEntry[] {
  const allScopes = scopes.includes("*");
  const allowedScopes = new Set(scopes);
  const allowedPerms = new Set(permissions);
  return ENDPOINTS.filter((e) => {
    if (!allScopes && !allowedScopes.has(e.scope)) return false;
    if (!allowedPerms.has(e.permission)) return false;
    return true;
  });
}

interface RenderOpts {
  key?: string;
  scopes: ApiScope[];
  permissions: ApiPermission[];
  origin?: string;
}

const DEFAULT_ORIGIN = "https://i-muslim.com";
const DOCS_PATH = "/en/developers";

function methodWidth(entries: EndpointEntry[]): number {
  return entries.reduce((w, e) => Math.max(w, e.method.length), 0);
}

export function renderQuickStart(opts: RenderOpts): string {
  const origin = opts.origin ?? DEFAULT_ORIGIN;
  const allowed = endpointsForKey(opts.scopes, opts.permissions);
  const keyLine = opts.key
    ? opts.key
    : "<paste your im_live_... key here>";

  const w = methodWidth(allowed);
  const endpointLines = allowed.length
    ? allowed.map((e) => `  ${e.method.padEnd(w)}  ${e.path}`).join("\n")
    : "  (none — no endpoints match this key's scope + permission combination)";

  const scopesLine = opts.scopes.includes("*")
    ? "*  (all resources)"
    : opts.scopes.join(", ");
  const permsLine = opts.permissions.join(", ");

  return `i-muslim Developer API — quick start
=====================================

Your API key:
  ${keyLine}

Scopes:        ${scopesLine}
Permissions:   ${permsLine}

Authentication:
  Every request needs the X-API-Key header.

Example (Qibla for London):
  curl -H "X-API-Key: ${opts.key ?? "im_live_..."}" \\
    "${origin}/api/v1/qibla?lat=51.5074&lng=-0.1278"

Endpoints this key can call:
${endpointLines}

Rate limit: 100 requests per minute per key. Every response includes
X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers.

CORS: GET endpoints are browser-callable from any origin.
      Writes (POST/PUT/PATCH) require a backend — never embed a write key
      in browser JavaScript.

Sacred-content rule: Arabic original text (text_ar) is read-only via API.
Only translations and metadata can be written.

Full reference: ${origin}${DOCS_PATH}
`;
}
