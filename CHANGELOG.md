# Changelog

All notable changes to **i-muslim** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Shared `<LanguageCombobox>`** (mus-1194) — searchable, alphabetically sorted dropdown of ~180 ISO-639-1 languages with locale-aware names (en/ar/id/ru/fr/ms/de/es supported; other UI locales fall back to English names). Replaces the free-text "Languages (comma-separated)" inputs on the profile form and the admin mosque form, and adds a new languages picker to the public mosque submission form. Multi-select with chips, mirrors the `<CountryCombobox>` pattern.

### Added
- **Hijri Date Converter** (mus-1191) — new tool page at `/hijri-converter` with two cards (Gregorian → Hijri and Hijri → Gregorian) plus a "Today" strip showing the current date in both calendars. Linked from the footer **Tools** column. Uses the existing `@umalqura/core` library; surfaces clear errors for out-of-range years and days that don't exist in the chosen Hijri month.
- Real per-language **completion percentage** on every Qur'an and Hadith translation row in /admin/settings (chip applies whether the row is enabled or disabled). Stats come from a pre-aggregated `config/translationStats` Firestore doc that the seed scripts maintain — the page does one read on load, no live count queries, no Firestore index dance. Click any row's name area to open a stats dialog showing translated / total / coverage, a per-collection breakdown for Hadith, an in-place enable/disable toggle, and a copy-to-clipboard `npm run seed:*:lang -- --lang=<code>` snippet for filling gaps.
- `npm run recompute:translation-stats` — standalone script that rebuilds `config/translationStats` by streaming `quran_ayahs` and `hadith_entries` and counting non-empty `translations.<lang>` values per language and per Hadith collection. Run once to bootstrap; subsequent seed runs (`seed:quran`, `seed:quran:lang`, `seed:hadith`, `seed:hadith:lang`) call it automatically at the end so stats stay fresh.

### Fixed
- Per-language Qur'an/Hadith seed scripts (`seed:quran:lang`, `seed:hadith:lang`) were writing translations as a literal top-level field with a dot in the key (`"translations.tr"`) rather than merging into the nested `translations` map. Result: 6,236 Turkish ayah translations were "successfully written" but invisible to the public site and to /admin/settings (which reported 0% coverage). Switched to the unambiguous nested-object merge form. **After pulling, re-run any per-language seed you previously ran** (e.g. `npm run seed:quran:lang -- --lang=tr`) so the data lands in the right place; the script auto-refreshes the stats doc at the end.

### Added
- **Shared `<CountryCombobox>`** (mus-1193) — searchable, alphabetically sorted dropdown of all ~250 countries, localized into en/ar/tr/id via `i18n-iso-countries`. Replaces hand-rolled country `<Input>` fields across the profile, matrimonial preferences, mosque admin form, public mosque submission, business editor, certification-bodies admin, and the matrimonial admin filter. Stores ISO-3166 alpha-2 codes; supports single-select and multi-select (chips) modes.
- `npm run migrate:country-iso2` — one-shot Firestore migration that converts legacy free-text `profile.country` and `matrimonialProfiles.*.country` values to ISO-2 codes. Idempotent; supports `--dry-run`.

### Changed
- Profile schema tightened: `country` is now `^[A-Z]{2}$` (or empty) instead of free-text 2–60 chars. Matrimonial `preferredCountries` is now a `string[]` of ISO-2 codes instead of a comma-separated text field.
- **Profile + Matrimonial merged.** Identity and deen fields (display name, gender, DOB, country/city, languages, madhhab, sect, prayer commitment, hijab/beard, education, profession, marital history, bio) now live on `/profile` as a single editable form and persist to `users/{uid}.profile`. Matrimonial-only fields (preferences, polygamy stance, photos) are gated behind an opt-in toggle on the new `/profile/matrimonial` page, which also hosts the inbox/matches view. `/matrimonial/onboarding`, `/matrimonial/settings`, and `/matrimonial/inbox` now redirect to the unified surface.
- Profile sidebar restyled as a rounded card inside the centered content area (sticky just below the top nav) instead of a full-bleed left rail. Sidebar nav trimmed to Overview / Reading / Favorites / Matrimonial — the four "Your space" link cards are gone, replaced by the inline editable profile form.

### Added
- Heart/Bookmark "save" button on individual Ayah, Surah header, Hadith, Article (card + detail), Event detail, and Matrimonial profile detail (bookmark variant — distinct from the existing Express-Interest heart). Anonymous clicks show a sign-in toast; signed-in clicks toggle a Firestore favorite optimistically.
- Reading progress auto-capture: an `IntersectionObserver` on Surah and Hadith book pages records the most-visible item (with a 2-second visibility threshold) and flushes it via `navigator.sendBeacon` to `/api/profile/reading-progress` on `visibilitychange === 'hidden'` or `pagehide`. Stored at `users/{uid}/state/readingProgress`.

### Changed
- Footer restructured (mus-1190): added a **Tools** column with the Zakat Calculator (moved out of Worship), demoted the Company links (About / Privacy / Terms / Contact) to inline horizontal links on the copyright line beside the language switcher, and moved the Quran/hadith source attribution from every page to a single **Credits** section on the About page.

### Removed
- Hijri Calendar admin section (was a stub; user-facing `/hijri-calendar` page is unchanged).

### Fixed
- Admin Events page falsely treated an empty `events` Firestore collection as "no Firestore" and fell back to mock mode, which disabled the "New event" button — making first-event creation impossible. `fetchEvents`, `fetchPublicEvents`, and `fetchPublicEvent` now only fall back to mock when Firebase Admin is unconfigured; an empty collection stays "live" so CRUD is always available.

### Changed
- Event `title` and `description` collapsed from per-language `{ en, ar }` to plain `string` end-to-end (types, Zod schema, Firestore reads/writes, admin form, public list, detail page, ICS export, JSON-LD). The admin form now has a single Title field and a single Description field; the public site renders that single value regardless of the surrounding UI locale.

### Added
- Activated reserved locales now show a **completion percentage chip** on each row in /admin/settings → Interface. Click the chip (or "Edit") to open a phrase-by-phrase editor that lists every key with the base value above and an editable input below; supports search, "untranslated only" filter, and bulk-save (only changed rows are written). Updates land at `config/uiLocales/locales/{code}.messages` via a new `updateUiLocaleMessagesAction` server action.

### Changed
- Activate-locale dialog widened to a two-column layout (metadata fields stacked on the left, translations JSON textarea filling the right column). The Direction field is gone — RTL is auto-derived from `RTL_LOCALES`, since whether a script is right-to-left is a property of the language code, not something the admin should toggle.
- Settings: each row's toggle is now the activation affordance for unactivated reserved locales (the separate "+ Activate" button is gone). Toggle reads OFF until activated; clicking opens the paste-JSON dialog. Once activated the toggle controls public-switcher visibility as before, and the locale is auto-included in `uiEnabled` so the toggle reads ON without a second click. The descriptive paragraphs above each tab's list have been removed.
- Admin Settings page is now tabbed (Interface / Qur'an / Hadith); the Interface tab merges the bundled and reserved locale lists into one. Reserved-locale rows show an "Activate" button when inactive and "Edit" + "Deactivate" once activated.
- "Download base JSON" button in the activate-locale dialog so admins can grab the latest `messages/<base>.json` to translate offline before pasting back.
- `npm run sync:locales` script: mirrors activated reserved-locale Firestore docs to the current bundled-locale shape, adding missing keys with English placeholders and dropping stale ones. Idempotent. CLAUDE.md instructs Claude to run it after any change to `messages/*.json` that adds, renames, or removes keys.
- Reserved-locale pool (`ru`, `az`, `fr`, `ur`, `fa`, `bn`, `ms`, `de`, `es`, `hi`) routable from day one. Admin can "Activate" any of them from /admin/settings → Reserved interface locales by pasting a translations JSON; the locale's messages live in Firestore (`config/uiLocales/locales/{code}`) and are deep-merged over the base locale at request time, so partial uploads fall back gracefully.
- Turkish (`tr`) Qur'an/Hadith translation language with Diyanet İşleri Quran translation. Run `npm run seed:quran:lang -- --lang=tr` and `npm run seed:hadith:lang -- --lang=tr` to populate text, then enable in /admin/settings.
- Per-language seed scripts (`seed:quran:lang`, `seed:hadith:lang`) — additive, idempotent, preserve admin-edited translations via `editedTranslations.<lang>` flag.
- Admin Settings page: enable/disable UI locales and Qur'an/Hadith translation languages; disabled entries are hidden from public switchers without affecting routing.

### Changed
- `config/languages` doc: `contentEnabled` split into `quranEnabled` + `hadithEnabled` so Qur'an and Hadith translation languages can be toggled independently. Reads fall back to legacy `contentEnabled` when only that field is present.
- `AyahDoc.translations` and `HadithDoc.translations` widened from fixed `{ en, ru }` to open `Record<string, string>`; renderer iterates over all keys present in the doc, so adding a translation language is purely additive.
- `LocalizedTextRequired` (used for business categories, amenities, mosque names, etc.) is now keyed by `BundledLocale` rather than the full `Locale` set. Authored content stays scoped to the four bundled UI locales; reserved locales fall back to English at render time via the new `pickLocalized` helper in [lib/utils.ts](lib/utils.ts).
- Initial Next.js 16 + React 19 + Tailwind 4 + TypeScript 5 scaffold (via `create-next-app`).
- Foundational documentation: `CLAUDE.md`, `Design.md`, `CHANGELOG.md`.
- `AGENTS.md` with Next.js version warning for coding agents.
- `CLAUDE.md` "Task completion" policy: agents auto-update `CHANGELOG.md` / `README.md` and commit (local only) at the end of each code-changing task.
