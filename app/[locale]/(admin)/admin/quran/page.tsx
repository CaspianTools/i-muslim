import Link from "next/link";
import { fetchSurahs } from "@/lib/admin/data/quran";

export const dynamic = "force-dynamic";

export default async function AdminQuranPage() {
  const { surahs, source } = await fetchSurahs();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quran</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {source === "empty"
            ? "Database is empty. Run npm run seed:quran to populate."
            : `${surahs.length} surahs.`}
        </p>
      </div>

      {source === "empty" ? (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-medium">No Quran data found in Firestore.</p>
          <p className="mt-1 text-muted-foreground">
            Make sure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
            FIREBASE_PRIVATE_KEY are set in <code>.env.local</code>, then run:
          </p>
          <pre className="mt-2 rounded-md bg-muted/40 p-2 font-mono text-xs">npm run seed:quran</pre>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground w-16">#</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground text-right">Arabic</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">Place</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground text-right">Ayahs</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground text-right">Edited</th>
              </tr>
            </thead>
            <tbody>
              {surahs.map((s) => (
                <tr key={s.number} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{s.number}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/quran/${s.number}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {s.name_en}
                    </Link>
                    <div className="text-xs text-muted-foreground">{s.name_translated}</div>
                  </td>
                  <td className="px-3 py-2 text-right" dir="rtl" lang="ar">
                    <span className="font-arabic text-lg">{s.name_ar}</span>
                  </td>
                  <td className="px-3 py-2 text-xs capitalize text-muted-foreground">{s.revelation_place}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.ayah_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.edited_count && s.edited_count > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {s.edited_count}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
