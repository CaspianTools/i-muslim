# Changelog

All notable changes to **i-muslim** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Admin Settings page: enable/disable UI locales and Qur'an/Hadith translation languages; disabled entries are hidden from public switchers without affecting routing.
- Initial Next.js 16 + React 19 + Tailwind 4 + TypeScript 5 scaffold (via `create-next-app`).
- Foundational documentation: `CLAUDE.md`, `Design.md`, `CHANGELOG.md`.
- `AGENTS.md` with Next.js version warning for coding agents.
- `CLAUDE.md` "Task completion" policy: agents auto-update `CHANGELOG.md` / `README.md` and commit (local only) at the end of each code-changing task.
