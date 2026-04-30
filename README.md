# i-muslim

A clean, fast reader for the Quran and the major Hadith collections, with
Arabic alongside English, Russian, and Azerbaijani translations.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com)
- [next-themes](https://www.npmjs.com/package/next-themes) for dark mode

## Data sources

- **Quran** — [quran.com API v4](https://api.quran.com/api/v4) (free, no auth)
  - Translations: Saheeh International (EN #20), Elmir Kuliev (RU #45),
    Alikhan Musayev (AZ #75)
- **Hadith** — [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api)
  served via jsDelivr CDN (free, no key)
  - Arabic and English for 9 collections (Bukhari, Muslim, Abu Dawud, Tirmidhi,
    Nasa'i, Ibn Majah, Malik, Nawawi 40, Qudsi 40)
  - Russian for Bukhari, Muslim, Abu Dawud
  - Azerbaijani hadith is not available in any free source. The public reader
    falls back to English with a "translation unavailable" badge; admins can
    fill individual hadiths via the per-hadith editor at
    `/admin/hadith/<collection>`, which has an AI-translate button (Gemini)
    once a key is configured at `/admin/integrations`.

## Getting started

```sh
npm install
npm run dev        # http://localhost:7777
npm run build      # production build
npm run start      # serve production build
npm run lint
```

## Routes

- `/` — landing
- `/quran` — list all 114 surahs
- `/quran/[surah]` — read a surah with selected translations
- `/hadith` — list of collections
- `/hadith/[collection]` — books within a collection
- `/hadith/[collection]/[book]` — hadith in a book
- `/search?q=...` — combined search across Quran and Hadith

Use the language chips on reader pages to toggle which translations appear
alongside the Arabic text. Selection is persisted in `localStorage` and
shared via the `?lang=` URL parameter.
