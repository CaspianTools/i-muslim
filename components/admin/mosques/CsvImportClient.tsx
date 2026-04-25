"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Papa from "papaparse";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { bulkImport, type MosqueInput } from "@/app/(admin)/admin/mosques/actions";
import { defaultPrayerCalc } from "@/lib/mosques/adhan";
import { emptyServices } from "@/lib/mosques/constants";

interface ParsedRow {
  ok: boolean;
  input?: MosqueInput;
  error?: string;
  raw: Record<string, string>;
}

const REQUIRED_COLS = ["name_en", "address", "city", "country", "lat", "lng", "timezone"] as const;

function rowToInput(row: Record<string, string>): { ok: boolean; input?: MosqueInput; error?: string } {
  for (const col of REQUIRED_COLS) {
    if (!row[col] || !row[col].trim()) return { ok: false, error: `missing ${col}` };
  }
  const lat = parseFloat(row.lat!);
  const lng = parseFloat(row.lng!);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: "bad coordinates" };
  if (!/^[A-Za-z]{2}$/.test(row.country!.trim())) return { ok: false, error: "country must be ISO2" };

  const input: MosqueInput = {
    name: {
      en: row.name_en!.trim(),
      ar: row.name_ar?.trim() || undefined,
      tr: row.name_tr?.trim() || undefined,
      id: row.name_id?.trim() || undefined,
    },
    legalName: row.legal_name?.trim() || undefined,
    denomination:
      ((row.denomination?.trim().toLowerCase() ?? "unspecified") as MosqueInput["denomination"]),
    description: row.description_en
      ? { en: row.description_en.trim() }
      : undefined,
    address: { line1: row.address!.trim() },
    city: row.city!.trim(),
    region: row.region?.trim() || undefined,
    country: row.country!.trim().toUpperCase(),
    location: { lat, lng },
    timezone: row.timezone!.trim(),
    contact: {
      phone: row.phone?.trim() || undefined,
      email: row.email?.trim() || undefined,
      website: row.website?.trim() || undefined,
    },
    languages: (row.languages ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    services: emptyServices(),
    prayerCalc: defaultPrayerCalc(),
    iqamah: {},
    status: "published",
  };
  return { ok: true, input };
}

export function CsvImportClient() {
  const router = useRouter();
  const t = useTranslations("mosquesAdmin.import");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [submitting, startTransition] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed: ParsedRow[] = result.data.map((raw) => {
          const r = rowToInput(raw);
          return { ok: r.ok, input: r.input, error: r.error, raw };
        });
        setRows(parsed);
      },
      error: (err) => toast.error(err.message),
    });
  }

  function importAll() {
    const valid = rows.filter((r) => r.ok && r.input).map((r) => r.input!);
    if (valid.length === 0) return;
    startTransition(async () => {
      const res = await bulkImport(valid);
      if (res.created > 0) toast.success(t("successToast", { count: res.created }));
      if (res.failed > 0) toast.error(`${res.failed} failed: ${res.errors.slice(0, 3).join(", ")}`);
      router.refresh();
      router.push("/admin/mosques");
    });
  }

  const valid = rows.filter((r) => r.ok).length;
  const invalid = rows.length - valid;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <label className="block text-sm font-medium">{t("selectFile")}</label>
        <Input type="file" accept=".csv,text/csv" onChange={onFile} className="mt-2 max-w-md" />
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{t("validRows", { count: valid })}</span>
            {invalid > 0 && <span className="text-danger">{t("errorRows", { count: invalid })}</span>}
            <Button
              size="sm"
              className="ms-auto"
              disabled={valid === 0 || submitting}
              onClick={importAll}
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Upload />}
              {submitting ? t("importing") : t("importAll")}
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">City</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Country</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">{r.raw.name_en || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.raw.city || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.raw.country || "—"}</td>
                    <td className="px-3 py-2">
                      {r.ok ? (
                        <span className="text-success">OK</span>
                      ) : (
                        <span className="text-danger">{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Showing first 50 of {rows.length} rows.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{tCommon("loading") /* spacer */}</p>
    </div>
  );
}
