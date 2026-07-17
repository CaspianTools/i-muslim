/**
 * Serialize a JSON-LD object for safe injection into a
 * `<script type="application/ld+json">` tag via `dangerouslySetInnerHTML`.
 *
 * `JSON.stringify` does not escape `<`, so a value containing `</script>`
 * (e.g. a user-submitted mosque/business/event name) would break out of the
 * script element and execute — a stored-XSS vector. Escaping `<` as its
 * `<` unicode form keeps the JSON semantically identical while making the
 * literal characters `</script>` and `<!--` impossible to emit.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
