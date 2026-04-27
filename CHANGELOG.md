# Changelog

All notable changes to **i-muslim** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Turkish (`tr`) Qur'an/Hadith translation language with Diyanet İşleri Quran translation. Run `npm run seed:quran:lang -- --lang=tr` and `npm run seed:hadith:lang -- --lang=tr` to populate text, then enable in /admin/settings.
- Per-language seed scripts (`seed:quran:lang`, `seed:hadith:lang`) — additive, idempotent, preserve admin-edited translations via `editedTranslations.<lang>` flag.
- Admin Settings page: enable/disable UI locales and Qur'an/Hadith translation languages; disabled entries are hidden from public switchers without affecting routing.

### Changed
- `AyahDoc.translations` and `HadithDoc.translations` widened from fixed `{ en, ru }` to open `Record<string, string>`; renderer iterates over all keys present in the doc, so adding a translation language is purely additive.
- Initial Next.js 16 + React 19 + Tailwind 4 + TypeScript 5 scaffold (via `create-next-app`).
- Foundational documentation: `CLAUDE.md`, `Design.md`, `CHANGELOG.md`.
- `AGENTS.md` with Next.js version warning for coding agents.
- `CLAUDE.md` "Task completion" policy: agents auto-update `CHANGELOG.md` / `README.md` and commit (local only) at the end of each code-changing task.
