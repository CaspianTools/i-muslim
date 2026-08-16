/**
 * Shared shapes for the /apps/* product pages.
 *
 * Deliberately a plain module: no `server-only`, no imports, no side effects.
 * `components/apps/ReleaseList.tsx` and `scripts/build-app-screenshots.ts` (run
 * under tsx, outside Next) both pull from here, and either of those would break
 * if this file dragged a server-only graph behind it.
 */

export type AppRelease = {
  /** Marketing version, e.g. "1.0.42". Not unique — 1.0.37 shipped twice. */
  version: string;
  /** Android versionCode. Unique and monotonic: the sort key and the React key. */
  versionCode: number;
  /** ISO yyyy-mm-dd. Absent on early releases where no date was recorded. */
  date?: string;
  /** One-line English headline. Always present. */
  summary: string;
  /** Full English release note as it shipped to Play. */
  note?: string;
};

/** How many releases an app page shows before linking to the full history. */
export const CHANGELOG_PREVIEW_COUNT = 10;
