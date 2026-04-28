# Changelog

All notable changes to **i-muslim** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
