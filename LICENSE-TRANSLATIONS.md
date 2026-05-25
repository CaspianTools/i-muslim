# Translation licensing

i-muslim's Quran and Hadith translation data is exposed publicly through the
`/api/v1/translations/*` endpoints. Because every translation in the data
store originates from a third-party source, **there is no single licence**
that covers the dataset — instead, **each translation is governed by the
licence of its original publisher**.

The authoritative answer for any individual translation is the response from
the API:

```json
{
  "data": {
    "resource": "quran",
    "lang": "en",
    "attribution": "Saheeh International",
    "license": "Proprietary (translator-held copyright)",
    "license_url": null,
    "source_url": "https://api.quran.com/api/v4/resources/translations/20",
    "source_id": "quran.com:20",
    "redistribute": "metadata-only",
    "notice": "Translator's copyright restricts redistribution. Fetch text directly from quran.com (resource id 20).",
    "count": 6236,
    "items": [{ "surah": 1, "ayah": 1, "text": null }, ...]
  }
}
```

Read the `license`, `license_url`, `attribution`, and `redistribute` fields
before using or republishing any item.

## `redistribute` modes

- **`"full"`** — text is returned verbatim in the API response. Currently
  applies to the Arabic Quran (Uthmani mushaf) and the Arabic Hadith editions
  — both are classical, public-domain texts.
- **`"metadata-only"`** — text is omitted (`text` is `null`). The API still
  returns the attribution, licence label, and `source_url` so you know where
  to obtain the text directly. Applies to every modern translator-authored
  translation (Saheeh International, Kuliev, Musayev, Diyanet, and the
  fawazahmed0-aggregated hadith translations).

We default to `"metadata-only"` whenever a translation's redistribution
licence is unclear. If you are a translator (or rights-holder) and want to
release a translation under an open licence so the API can ship its text in
full, please write to us through the contact form — we'd love to.

## Contributing or correcting a translation

Send corrections and contributions through the contact form
([/contact](/contact)) with subject **"Translation contribution"**. Include
the diff, the source you took the text from, and the licence you're releasing
your contribution under. We'll review and merge.

## Scope

This document covers the **translation content** served by
`/api/v1/translations/*` only. It does not cover the i-muslim application
source code or other site content.
