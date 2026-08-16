// The single tafsir renderer. Deliberately carries NEITHER "use client" nor
// "server-only" so the same component renders the server-side block pages and
// the client-side inline panel — one implementation, no drift. Same reasoning
// as the header of lib/text/html.ts.
//
// Everything is a React text child, so React escapes it. There is no
// dangerouslySetInnerHTML anywhere in this path.

import {
  paragraphDirection,
  splitParagraphs,
  tokenizeParagraph,
  type TafsirToken,
} from "@/lib/tafsir/render";
import type { TafsirLang } from "@/lib/tafsir/works";
import { cn } from "@/lib/utils";

function Token({
  token,
  paraDir,
  honorificLabel,
}: {
  token: TafsirToken;
  paraDir: "rtl" | "ltr";
  honorificLabel: string;
}) {
  switch (token.kind) {
    case "quran":
      // In RTL prose the run already flows correctly, so a plain span keeps the
      // markup light. In LTR prose it needs isolating.
      return paraDir === "rtl" ? (
        <span lang="ar" className="tafsir-quran">
          {token.value}
        </span>
      ) : (
        <bdi lang="ar" dir="rtl" className="tafsir-quran">
          {token.value}
        </bdi>
      );
    case "arabic":
      // <bdi> is the native element for "an inline run whose direction must not
      // leak into the surrounding text". Without isolation, Latin punctuation
      // after an embedded hadith reorders visibly and wrongly.
      return (
        <bdi lang="ar" dir="rtl" className="tafsir-ar-run">
          {token.value}
        </bdi>
      );
    case "honorific":
      // Screen readers handle U+FDFA inconsistently — some read the full
      // phrase, some read nothing. role="img" + a localised label is the honest
      // markup for one glyph standing in for a whole phrase.
      return (
        <span lang="ar" className="tafsir-honorific" role="img" aria-label={honorificLabel}>
          {token.value}
        </span>
      );
    default:
      return <>{token.value}</>;
  }
}

export function TafsirText({
  text,
  lang,
  honorificLabel,
  className,
}: {
  text: string;
  lang: TafsirLang;
  /** Localised reading of ﷺ, e.g. "peace and blessings be upon him". */
  honorificLabel: string;
  className?: string;
}) {
  const paragraphs = splitParagraphs(text);
  const blockDir = lang === "ar" ? "rtl" : "ltr";

  return (
    <div className={cn("tafsir-prose", className)} dir={blockDir} lang={lang}>
      {paragraphs.map((paragraph, i) => {
        const paraDir = paragraphDirection(paragraph, lang);
        const tokens = tokenizeParagraph(paragraph, lang);
        return (
          <p
            // Paragraph order is the only stable identity plain prose has.
            key={i}
            dir={paraDir === blockDir ? undefined : paraDir}
            lang={paraDir === "rtl" && lang !== "ar" ? "ar" : undefined}
          >
            {tokens.map((token, j) => (
              <Token key={j} token={token} paraDir={paraDir} honorificLabel={honorificLabel} />
            ))}
          </p>
        );
      })}
    </div>
  );
}
