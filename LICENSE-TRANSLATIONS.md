# Translation licensing

i-muslim's Quran and Hadith translation data is exposed publicly through the
`/api/v1/translations/*` endpoints. There is no single licence covering the
whole dataset — **each item is governed by the licence of its original
author**, and the API response carries that licence verbatim.

There are three buckets:

## 1. Full text (CC0) — authored by i-muslim

Hadith translations that i-muslim has written or substantively edited itself.
In Firestore each such translation carries
`editedTranslations[lang] === true`; the public API reads that flag per item
and ships the text under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
attributed to **"i-muslim"**.

CC0 means: do anything, no attribution required, no warranty. Mirror it,
modify it, sell it, ship it in your own app.

Authored counts per (collection, language) are visible on the
[/downloads page](/downloads) and live in
`config/translationStats.hadith.perCollection[*].authoredPerLang` — refreshed
by `npm run recompute:translation-stats` and by every seed run.

## 2. Full text — classical Arabic originals

The Uthmani Quran mushaf and the classical Arabic Hadith editions are
centuries-old text in the public domain. The API returns them verbatim and
the response declares `license: "Public Domain"`.

## 3. Metadata only — modern translator-copyrighted translations

Modern translations we did **not** author — Saheeh International (Quran EN),
Elmir Kuliev (Quran RU), Alikhan Musayev (Quran AZ), Diyanet (Quran TR), and
the fawazahmed0-aggregated Hadith translations for any item we haven't
re-authored — remain under their original translators' copyright. The API
returns the provenance stanza (`attribution`, `license`, `source_url`) but
sets `text: null`. Fetch the text directly from the upstream `source_url`.

We default to this bucket whenever a translation's redistribution licence is
unclear. If you hold the copyright on one of these translations and want to
release it under an open licence, please get in touch through the
[contact form](/contact?subject=Translation+licence+grant).

## How to read it programmatically

Non-Arabic Hadith endpoints return both licence stanzas plus a per-item
`source` tag, so consumers can filter cleanly:

```bash
curl https://i-muslim.com/api/v1/translations/hadith/bukhari/en \
  | jq '.data.sources, (.data.items | map(select(.source == "authored")) | length)'
```

```json
{
  "data": {
    "resource": "hadith",
    "collection": "bukhari",
    "lang": "en",
    "sources": {
      "authored": {
        "attribution": "i-muslim",
        "license": "CC0-1.0",
        "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "redistribute": "full",
        "count": 4321
      },
      "imported": {
        "attribution": "Various translators (aggregated by fawazahmed0/hadith-api from sunnah.com)",
        "license": "Proprietary (translator-held copyright)",
        "license_url": "https://github.com/fawazahmed0/hadith-api/blob/1/References.md",
        "source_url": "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-bukhari.min.json",
        "source_id": "fawazahmed0:eng-bukhari",
        "redistribute": "metadata-only",
        "count": 3242
      }
    },
    "count": 7563,
    "items": [
      { "number": 1, "text": "...", "source": "authored" },
      { "number": 2, "text": null, "source": "imported" }
    ]
  }
}
```

Arabic Hadith and all Quran endpoints return a single envelope (no
authored/imported split — Arabic is public-domain classical text;
authored-Quran is out of scope for this revision).

## Contributing or correcting a translation

Send corrections and contributions through the contact form
([/contact](/contact)) with subject **"Translation contribution"**. Include
the diff, the source you took the text from, and the licence you're
releasing your contribution under. Accepted contributions land in the
CC0-authored pool and are returned in full by the API.

## Scope

This document covers the **translation content** served by
`/api/v1/translations/*` only. It does not cover the i-muslim application
source code or other site content.
