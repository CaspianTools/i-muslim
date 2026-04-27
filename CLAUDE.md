@AGENTS.md

# CLAUDE.md

Guidance for Claude Code when working in this repository. (Also imports [AGENTS.md](AGENTS.md) above — read the Next.js version warning there first.)

## Project

**i-muslim** is an all-in-one Islamic companion web app: Prayer Times, Qibla direction, Quran, Hadith, Duas, and the Hijri calendar in one place.

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript 5
- Tailwind CSS 4 (via `@tailwindcss/postcss`)
- ESLint 9 with `eslint-config-next`

## Running locally

```bash
npm install
npm run dev       # start dev server on http://localhost:3000
npm run build     # production build
npm run start     # serve production build
npm run lint      # eslint
```

## Conventions

- App Router only — pages live under `app/`.
- Prefer server components; add `"use client"` only where interactivity or browser-only APIs (geolocation, DeviceOrientation) are needed.
- Tailwind for styling; colocate component-specific CSS in `app/globals.css` or component files only when Tailwind is insufficient.
- TBD — refine as the codebase grows.

## Task completion

When a task is functionally complete and verified (build/lint pass where relevant, feature manually tested where the change is user-facing), wrap it up without waiting for a separate "please commit" prompt:

1. **Update [CHANGELOG.md](CHANGELOG.md)** — add a one-line entry under `## [Unreleased]` in the appropriate `### Added` / `### Changed` / `### Fixed` / `### Removed` group. Keep-a-Changelog format.
2. **Update [README.md](README.md)** — only if the change affects setup, run commands, data sources, or user-visible behavior documented there. Skip for purely internal refactors.
3. **Commit** all task-related changes in a single commit using the repo's existing message style (see `git log`). Do **not** sweep up unrelated pre-existing modifications — stage only the files this task touched.
4. **Do not push** — leave the commit local for the user to review and push manually.

Skip steps 1–3 entirely for read-only investigations, planning sessions, or tasks the user explicitly marked as exploratory/draft.

## Islamic-domain notes

- **Arabic text is RTL.** Any component rendering Arabic must set `dir="rtl"` and use a font that supports the intended script (Uthmani / IndoPak).
- **Prayer-time calculation methods differ by region** (MWL, ISNA, Umm al-Qura, Egyptian, Karachi, etc.). Never hardcode a method — let the user pick and persist the choice.
- **Hijri dates are not a simple offset.** Use a dedicated library (e.g. `moment-hijri`, `@umalqura/core`) rather than ad-hoc conversion.
- **Qibla** is the great-circle bearing from the user's coordinates to the Kaaba (21.4225° N, 39.8262° E). Compass heading on the web requires explicit `DeviceOrientationEvent` permission on iOS Safari.
- Hadith/Quran text is sacred content — render it faithfully; do not paraphrase, silently truncate, or let translations override the original Arabic.

## See also

- [Design.md](Design.md) — feature scope and architecture
- [CHANGELOG.md](CHANGELOG.md) — version history
- [AGENTS.md](AGENTS.md) — generic agent rules (Next.js version warning)
