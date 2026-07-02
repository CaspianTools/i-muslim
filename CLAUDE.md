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

## Translations

After modifying any `messages/<locale>.json` (especially [messages/en.json](messages/en.json)) in a way that **adds, renames, or removes keys**, run `npm run sync:locales` before committing.

The script reads activated reserved UI locales from Firestore (`config/uiLocales/locales/*`) and patches each one to mirror the new English shape — adding missing keys with the English value as a placeholder, removing stale keys, and leaving previously-translated values alone. Without this step, activated locales render partial-English silently for any new key (the [i18n/request.ts](i18n/request.ts) deep-merge fallback masks the gap), so the admin can't see what still needs a real translation.

Skip the script if no key set changed (pure value edits, typo fixes inside an existing string, etc.).

## Task completion

When a task is functionally complete and verified (build/lint pass where relevant, feature manually tested where the change is user-facing), wrap it up without waiting for a separate "please commit" prompt:

1. **Update [CHANGELOG.md](CHANGELOG.md)** — add a one-line entry under `## [Unreleased]` in the appropriate `### Added` / `### Changed` / `### Fixed` / `### Removed` group. Keep-a-Changelog format.
2. **Update [README.md](README.md)** — only if the change affects setup, run commands, data sources, or user-visible behavior documented there. Skip for purely internal refactors.
3. **Commit** all task-related changes in a single commit using the repo's existing message style (see `git log`). Do **not** sweep up unrelated pre-existing modifications — stage only the files this task touched.
4. **Push** the commit to the remote (`git push`) — this is **mandatory** at the end of every task so the change reaches production (e.g. App Hosting deploy / live site). If the push fails (no upstream, auth, protected branch, conflict), report the exact error instead of leaving it silently unpushed. If you created a new branch for the work, push it with `-u` to set the upstream.

Skip steps 1–4 entirely for read-only investigations, planning sessions, or tasks the user explicitly marked as exploratory/draft.

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

## Worktrees & the ship rule

Claude Code can run parallel sessions in isolated **git worktrees** (`claude --worktree <name>`, or ask it to "work in a worktree" → the `EnterWorktree` tool). A worktree lives under `.claude/worktrees/<name>/` on branch `worktree-<name>`, branched **fresh from `origin/main`** by default (set `worktree.baseRef: "head"` in `.claude/settings.json` to carry local HEAD instead). `.claude/worktrees/` is gitignored and **`.worktreeinclude`** copies your local secrets (`.env*`, service-account / Firebase-admin / credential keys) into new worktrees — see those two files. `node_modules` is *not* copied: run `npm install` in each new worktree.

**The catch:** this repo deploys to production on **push to `main`** — the live site is served by **Firebase App Hosting**, which auto-builds and rolls out whatever lands on `main` (see the "Push" step in [Task completion](#task-completion) above). There is no GitHub Actions deploy workflow; the only workflow ([`security-audit.yml`](.github/workflows/security-audit.yml)) runs `npm audit` on PRs/schedule and ships nothing. So push-to-`main` = production deploy. A worktree sits on `worktree-<name>`, and the standing "commit + push at end of task" flow (Task completion, step 4) **adapts inside a worktree** — do NOT blindly push from one:

1. **Commit, pause before landing.** Auto-commit finished work on the `worktree-<name>` branch, then **stop and report**. Never merge to `main` / push `main` (the step that deploys to App Hosting) without the owner's explicit go-ahead. *(On `main` — the normal solo flow — the rule is unchanged: commit + push, which deploys.)*
2. **Serialize landings — one at a time.** Never land two worktrees to `main` in parallel. If another worktree/session is still in flight, wait for it to land first. There's no live cross-session signal, so "wait" means: at land time `git fetch` and rebase onto whatever `origin/main` now is; if the owner says another is mid-flight, hold until told it's done.
3. **Resolve conflicts in the worktree, never on `main`.** At land time: `git fetch origin` → **rebase `worktree-<name>` onto the latest `origin/main`** → resolve every conflict *there*, so `main` only ever receives an already-merged, clean tree.
4. **Finalize the version/release bump last.** Update [CHANGELOG.md](CHANGELOG.md) (the `## [Unreleased]` entry per Task completion, step 1) and `version` in [package.json](package.json) only *after* the rebase — those are the guaranteed collision between two shippable worktrees, so pick the number against current `main`, not stale HEAD. If a locale key set changed, re-run `npm run sync:locales` after the rebase too.
5. **Re-verify + rebuild after resolving.** Re-run the checks that apply to the change: `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` for user-facing work (plus `npm run check:locales` if translations moved). A conflict resolution that isn't re-verified is a bug waiting to ship.
6. **Only then ship.** Fast-forward `main` to the clean, verified branch → `git push origin main` → Firebase App Hosting builds and deploys the new revision. Confirm the deploy went green and the live site picked up the change. **Never push a conflicted or failing tree to `main`.**

For solo, single-stream work that ships immediately, **skip worktrees and work on `main` directly** — the Task-completion flow needs no adaptation. Reserve worktrees for genuine parallelism (two tasks at once) or experiments you may not ship.
