"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import { saveProfile } from "@/app/(site)/matrimonial/actions";
import { PhotoUploadStub } from "./PhotoUploadStub";
import type { MatrimonialProfile } from "@/types/matrimonial";

type Values = {
  displayName: string;
  gender: "male" | "female";
  dateOfBirth: string;
  country: string;
  city: string;
  ethnicity: string;
  languages: string;
  madhhab: "hanafi" | "maliki" | "shafii" | "hanbali" | "other" | "none";
  sect: "sunni" | "shia" | "other";
  prayerCommitment: "always" | "mostly" | "sometimes" | "rarely" | "learning";
  hijab: "niqab" | "khimar" | "shayla" | "none" | "na";
  beard: "full" | "trimmed" | "none" | "na";
  revert: boolean;
  polygamyStance: "open" | "neutral" | "closed" | "na";
  maritalHistory: "never_married" | "divorced" | "widowed";
  hasChildren: boolean;
  wantsChildren: "yes" | "no" | "maybe";
  education: "high_school" | "diploma" | "bachelor" | "master" | "phd" | "other";
  profession: string;
  lookingForGender: "male" | "female";
  ageMin: number;
  ageMax: number;
  preferredCountries: string;
  preferredMadhhabs: string;
  prayerMin: "always" | "mostly" | "sometimes" | "rarely" | "learning";
  polygamyAcceptable: boolean;
  bio: string;
};

function defaultsFrom(initial: MatrimonialProfile | null): Values {
  return {
    displayName: initial?.displayName ?? "",
    gender: initial?.gender ?? "male",
    dateOfBirth: initial?.dateOfBirth?.slice(0, 10) ?? "",
    country: initial?.country ?? "",
    city: initial?.city ?? "",
    ethnicity: initial?.ethnicity ?? "",
    languages: (initial?.languages ?? []).join(", "),
    madhhab: initial?.madhhab ?? "none",
    sect: initial?.sect ?? "sunni",
    prayerCommitment: initial?.prayerCommitment ?? "mostly",
    hijab: initial?.hijab ?? "na",
    beard: initial?.beard ?? "na",
    revert: initial?.revert ?? false,
    polygamyStance: initial?.polygamyStance ?? "na",
    maritalHistory: initial?.maritalHistory ?? "never_married",
    hasChildren: initial?.hasChildren ?? false,
    wantsChildren: initial?.wantsChildren ?? "yes",
    education: initial?.education ?? "bachelor",
    profession: initial?.profession ?? "",
    lookingForGender:
      initial?.preferences.lookingForGender ?? (initial?.gender === "male" ? "female" : "male"),
    ageMin: initial?.preferences.ageMin ?? 22,
    ageMax: initial?.preferences.ageMax ?? 35,
    preferredCountries: (initial?.preferences.countries ?? []).join(", "),
    preferredMadhhabs: (initial?.preferences.madhhabs ?? []).join(", "),
    prayerMin: initial?.preferences.prayerMin ?? "sometimes",
    polygamyAcceptable: initial?.preferences.polygamyAcceptable ?? false,
    bio: initial?.bio ?? "",
  };
}

export function OnboardingForm({ initial }: { initial: MatrimonialProfile | null }) {
  const router = useRouter();
  const t = useTranslations("matrimonial.onboarding");
  const tCommon = useTranslations("common");
  const tGenders = useTranslations("matrimonial.genders");
  const tMadhhabs = useTranslations("matrimonial.madhhabs");
  const tPrayer = useTranslations("matrimonial.prayer");
  const tHijab = useTranslations("matrimonial.hijab");
  const tBeard = useTranslations("matrimonial.beard");
  const tPolygamy = useTranslations("matrimonial.polygamy");
  const tMarital = useTranslations("matrimonial.marital");
  const tWants = useTranslations("matrimonial.wantsChildren");
  const tEducation = useTranslations("matrimonial.education");

  const [pending, startTransition] = useTransition();
  const [photoUrls, setPhotoUrls] = useState<string[]>(
    (initial?.photos ?? []).map((p) => p.url),
  );

  const schema = z.object({
    displayName: z.string().min(2, t("errorRequired")),
    gender: z.enum(["male", "female"]),
    dateOfBirth: z.string().min(8, t("errorRequired")),
    country: z.string().min(2, t("errorRequired")),
    city: z.string().min(1, t("errorRequired")),
    ethnicity: z.string(),
    languages: z.string(),
    madhhab: z.enum(["hanafi", "maliki", "shafii", "hanbali", "other", "none"]),
    sect: z.enum(["sunni", "shia", "other"]),
    prayerCommitment: z.enum(["always", "mostly", "sometimes", "rarely", "learning"]),
    hijab: z.enum(["niqab", "khimar", "shayla", "none", "na"]),
    beard: z.enum(["full", "trimmed", "none", "na"]),
    revert: z.boolean(),
    polygamyStance: z.enum(["open", "neutral", "closed", "na"]),
    maritalHistory: z.enum(["never_married", "divorced", "widowed"]),
    hasChildren: z.boolean(),
    wantsChildren: z.enum(["yes", "no", "maybe"]),
    education: z.enum(["high_school", "diploma", "bachelor", "master", "phd", "other"]),
    profession: z.string(),
    lookingForGender: z.enum(["male", "female"]),
    ageMin: z.number().int().min(18).max(99),
    ageMax: z.number().int().min(18).max(99),
    preferredCountries: z.string(),
    preferredMadhhabs: z.string(),
    prayerMin: z.enum(["always", "mostly", "sometimes", "rarely", "learning"]),
    polygamyAcceptable: z.boolean(),
    bio: z.string().min(50, t("errorBio")).max(800, t("errorBio")),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFrom(initial),
  });

  function onSubmit(values: Values) {
    startTransition(async () => {
      const result = await saveProfile({
        ...values,
        photoStubs: photoUrls,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("completed"));
      router.push("/matrimonial/settings");
      router.refresh();
    });
  }

  return (
    <form className="mt-4 space-y-8" onSubmit={handleSubmit(onSubmit)}>
      <Section title={t("stepIdentity")}>
        <Field label={t("displayName")} error={errors.displayName?.message}>
          <Input placeholder={t("displayNamePlaceholder")} {...register("displayName")} />
        </Field>
        <Field label={t("gender")} error={errors.gender?.message}>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" {...register("gender")}>
            <option value="male">{tGenders("male")}</option>
            <option value="female">{tGenders("female")}</option>
          </select>
        </Field>
        <Field label={t("dateOfBirth")} error={errors.dateOfBirth?.message}>
          <Input type="date" {...register("dateOfBirth")} />
        </Field>
        <Field label={t("country")} error={errors.country?.message}>
          <Input {...register("country")} />
        </Field>
        <Field label={t("city")} error={errors.city?.message}>
          <Input {...register("city")} />
        </Field>
        <Field label={t("ethnicity")}>
          <Input {...register("ethnicity")} />
        </Field>
        <Field label={t("languages")}>
          <Input placeholder="en, ar, tr" {...register("languages")} />
        </Field>
      </Section>

      <Section title={t("stepReligion")}>
        <Field label={t("madhhab")}>
          <Select {...register("madhhab")}>
            {(["hanafi", "maliki", "shafii", "hanbali", "other", "none"] as const).map((m) => (
              <option key={m} value={m}>{tMadhhabs(m)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("sect")}>
          <Select {...register("sect")}>
            <option value="sunni">Sunni</option>
            <option value="shia">Shia</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label={t("prayerCommitment")}>
          <Select {...register("prayerCommitment")}>
            {(["always", "mostly", "sometimes", "rarely", "learning"] as const).map((p) => (
              <option key={p} value={p}>{tPrayer(p)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("hijab")}>
          <Select {...register("hijab")}>
            {(["niqab", "khimar", "shayla", "none", "na"] as const).map((h) => (
              <option key={h} value={h}>{tHijab(h)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("beard")}>
          <Select {...register("beard")}>
            {(["full", "trimmed", "none", "na"] as const).map((b) => (
              <option key={b} value={b}>{tBeard(b)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("polygamyStance")}>
          <Select {...register("polygamyStance")}>
            {(["open", "neutral", "closed", "na"] as const).map((p) => (
              <option key={p} value={p}>{tPolygamy(p)}</option>
            ))}
          </Select>
        </Field>
        <label className="inline-flex items-center gap-2 text-sm">
          <Checkbox {...register("revert")} />
          {t("revert")}
        </label>
      </Section>

      <Section title={t("stepBackground")}>
        <Field label={t("maritalHistory")}>
          <Select {...register("maritalHistory")}>
            {(["never_married", "divorced", "widowed"] as const).map((m) => (
              <option key={m} value={m}>{tMarital(m)}</option>
            ))}
          </Select>
        </Field>
        <label className="inline-flex items-center gap-2 text-sm">
          <Checkbox {...register("hasChildren")} />
          {t("hasChildren")}
        </label>
        <Field label={t("wantsChildren")}>
          <Select {...register("wantsChildren")}>
            {(["yes", "no", "maybe"] as const).map((w) => (
              <option key={w} value={w}>{tWants(w)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("education")}>
          <Select {...register("education")}>
            {(["high_school", "diploma", "bachelor", "master", "phd", "other"] as const).map((e) => (
              <option key={e} value={e}>{tEducation(e)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("profession")}>
          <Input {...register("profession")} />
        </Field>
      </Section>

      <Section title={t("stepPreferences")}>
        <Field label={t("lookingForGender")}>
          <Select {...register("lookingForGender")}>
            <option value="male">{tGenders("male")}</option>
            <option value="female">{tGenders("female")}</option>
          </Select>
        </Field>
        <Field label={t("ageRange")}>
          <div className="flex gap-2">
            <Input type="number" min={18} max={99} {...register("ageMin", { valueAsNumber: true })} />
            <Input type="number" min={18} max={99} {...register("ageMax", { valueAsNumber: true })} />
          </div>
        </Field>
        <Field label={t("preferredCountries")}>
          <Input placeholder="GB, US, TR" {...register("preferredCountries")} />
        </Field>
        <Field label={t("preferredMadhhabs")}>
          <Input placeholder="hanafi, maliki" {...register("preferredMadhhabs")} />
        </Field>
        <Field label={t("prayerMin")}>
          <Select {...register("prayerMin")}>
            {(["always", "mostly", "sometimes", "rarely", "learning"] as const).map((p) => (
              <option key={p} value={p}>{tPrayer(p)}</option>
            ))}
          </Select>
        </Field>
        <label className="inline-flex items-center gap-2 text-sm">
          <Checkbox {...register("polygamyAcceptable")} />
          {t("polygamyAcceptable")}
        </label>
      </Section>

      <Section title={t("stepBio")}>
        <Field label={t("bio")} error={errors.bio?.message}>
          <textarea
            rows={5}
            placeholder={t("bioPlaceholder")}
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
            {...register("bio")}
          />
        </Field>
        <Field label={t("photos")}>
          <PhotoUploadStub initial={photoUrls} onChange={setPhotoUrls} />
        </Field>
      </Section>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("submit")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{tCommon("save")}</p>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
    />
  );
}
