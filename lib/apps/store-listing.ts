/**
 * Parser for the `RELEASES` array inside the i-muslim-Quran repo's
 * play-assets/store-listing.html — that file is the app's single source of
 * truth for releases (see that repo's CLAUDE.md, release workflow step 1), so
 * the site reads releases straight out of it instead of relying on a
 * hand-copied list here.
 *
 * The array is a JS literal inside a <script> tag, e.g.:
 *
 *   var RELEASES=[
 *   {v:'1.0.42',code:44,date:'2026-07-31',shipped:1,shots:'release-44',
 *    summary:'…', notes:{'en-US':`…`, 'ar':`…`}},
 *   {v:'1.0.40',code:42,date:'2026-07-29',shipped:1,summary:'…', note:`…`}]
 *
 * so this is a tiny reader for that literal subset of JS: objects with bare or
 * quoted keys, '/"/` strings with backslash escapes, numbers, booleans, null,
 * nested objects/arrays. Anything outside that subset (interpolation, function
 * calls) throws — the caller treats any throw as "format changed" and falls
 * back to the committed snapshot rather than rendering something half-parsed.
 */

export type StoreListingRelease = {
  version: string;
  versionCode: number;
  /** ISO yyyy-mm-dd when recorded. */
  date?: string;
  /** False for prepared-but-never-shipped versionCodes (`shipped:0`). */
  shipped: boolean;
  summary?: string;
  /** The English (`en-US`) release note. */
  note?: string;
};

class LiteralReader {
  constructor(
    private readonly src: string,
    private pos: number,
  ) {}

  private error(msg: string): never {
    throw new Error(`store-listing parse error at ${this.pos}: ${msg}`);
  }

  private skipWs(): void {
    for (;;) {
      const c = this.src[this.pos];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") {
        this.pos++;
      } else if (c === "/" && this.src[this.pos + 1] === "/") {
        const nl = this.src.indexOf("\n", this.pos);
        this.pos = nl === -1 ? this.src.length : nl + 1;
      } else if (c === "/" && this.src[this.pos + 1] === "*") {
        const end = this.src.indexOf("*/", this.pos + 2);
        if (end === -1) this.error("unterminated comment");
        this.pos = end + 2;
      } else {
        return;
      }
    }
  }

  private readString(quote: string): string {
    this.pos++; // past the opening quote
    let out = "";
    for (;;) {
      const c = this.src[this.pos];
      if (c === undefined) this.error("unterminated string");
      if (c === quote) {
        this.pos++;
        return out;
      }
      if (c === "\\") {
        const next = this.src[this.pos + 1];
        if (next === undefined) this.error("unterminated escape");
        out += next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "\r" : next;
        this.pos += 2;
        continue;
      }
      if (quote === "`" && c === "$" && this.src[this.pos + 1] === "{") {
        // The release notes are static text; interpolation means the format
        // changed under us, so bail out rather than guess.
        this.error("template interpolation is not supported");
      }
      if (quote !== "`" && (c === "\n" || c === "\r")) {
        this.error("newline in single-line string");
      }
      out += c;
      this.pos++;
    }
  }

  private readNumber(): number {
    const start = this.pos;
    if (this.src[this.pos] === "-") this.pos++;
    while (/[0-9.eE+]/.test(this.src[this.pos] ?? "")) this.pos++;
    const n = Number(this.src.slice(start, this.pos));
    if (Number.isNaN(n) || start === this.pos) this.error("invalid number");
    return n;
  }

  private readKey(): string {
    this.skipWs();
    const c = this.src[this.pos];
    if (c === "'" || c === '"' || c === "`") return this.readString(c);
    const m = /^[A-Za-z_$][\w$]*/.exec(this.src.slice(this.pos));
    if (!m) this.error("expected object key");
    this.pos += m[0].length;
    return m[0];
  }

  private readObject(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    this.pos++; // past '{'
    this.skipWs();
    if (this.src[this.pos] === "}") {
      this.pos++;
      return obj;
    }
    for (;;) {
      const key = this.readKey();
      this.skipWs();
      if (this.src[this.pos] !== ":") this.error(`expected ':' after key "${key}"`);
      this.pos++;
      obj[key] = this.readValue();
      this.skipWs();
      const c = this.src[this.pos];
      if (c === ",") {
        this.pos++;
        this.skipWs();
        if (this.src[this.pos] === "}") {
          this.pos++;
          return obj;
        }
        continue;
      }
      if (c === "}") {
        this.pos++;
        return obj;
      }
      this.error("expected ',' or '}' in object");
    }
  }

  private readArray(): unknown[] {
    const arr: unknown[] = [];
    this.pos++; // past '['
    this.skipWs();
    if (this.src[this.pos] === "]") {
      this.pos++;
      return arr;
    }
    for (;;) {
      arr.push(this.readValue());
      this.skipWs();
      const c = this.src[this.pos];
      if (c === ",") {
        this.pos++;
        this.skipWs();
        if (this.src[this.pos] === "]") {
          this.pos++;
          return arr;
        }
        continue;
      }
      if (c === "]") {
        this.pos++;
        return arr;
      }
      this.error("expected ',' or ']' in array");
    }
  }

  readValue(): unknown {
    this.skipWs();
    const c = this.src[this.pos];
    if (c === undefined) this.error("unexpected end of input");
    if (c === "'" || c === '"' || c === "`") return this.readString(c);
    if (c === "{") return this.readObject();
    if (c === "[") return this.readArray();
    if (c === "-" || (c >= "0" && c <= "9")) return this.readNumber();
    const word = /^[A-Za-z_$][\w$]*/.exec(this.src.slice(this.pos));
    if (word) {
      this.pos += word[0].length;
      if (word[0] === "true") return true;
      if (word[0] === "false") return false;
      if (word[0] === "null") return null;
      if (word[0] === "undefined") return undefined;
      this.error(`unsupported identifier "${word[0]}"`);
    }
    this.error(`unexpected character "${c}"`);
  }
}

/**
 * Extract every release from the store-listing HTML, newest first as authored.
 * Throws if the RELEASES array cannot be found or read — callers must treat a
 * throw as "fall back to the committed snapshot".
 */
export function parseStoreListingReleases(html: string): StoreListingRelease[] {
  const marker = /\b(?:var|let|const)\s+RELEASES\s*=\s*\[/.exec(html);
  if (!marker) throw new Error("RELEASES array not found in store-listing.html");

  const raw = new LiteralReader(
    html,
    marker.index + marker[0].length - 1, // sit on the '['
  ).readValue();
  if (!Array.isArray(raw)) throw new Error("RELEASES did not parse to an array");

  const releases: StoreListingRelease[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.v !== "string" || e.v === "" || typeof e.code !== "number") {
      throw new Error("release entry is missing v/code — format changed?");
    }
    const notes =
      typeof e.notes === "object" && e.notes !== null
        ? (e.notes as Record<string, unknown>)
        : undefined;
    const note = typeof e.note === "string" ? e.note : notes?.["en-US"];
    releases.push({
      version: e.v,
      versionCode: e.code,
      date:
        typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
          ? e.date
          : undefined,
      shipped: e.shipped !== 0 && e.shipped !== false,
      summary: typeof e.summary === "string" ? e.summary : undefined,
      note: typeof note === "string" ? note : undefined,
    });
  }
  if (releases.length === 0) throw new Error("RELEASES parsed to zero entries");
  return releases;
}
