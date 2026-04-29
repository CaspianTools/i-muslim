"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import { CountryCombobox } from "@/components/common/CountryCombobox";
import { LanguageCombobox } from "@/components/common/LanguageCombobox";
import { Section } from "./forms/Section";
import { Field } from "./forms/Field";
import { Select } from "./forms/Select";
import {
  profileFieldsSchema,
  type ProfileFieldsInput,
  type ProfileFieldsRecord,
} from "@/lib/profile/schema";
import { saveProfileFieldsAction } from "@/app/[locale]/(site)/profile/actions";

function defaultsFrom(initial: ProfileFieldsRecord | null): ProfileFieldsInput {
  return {
    displayName: initial?.displayName ?? "",
    gender: initial?.gender ?? "male",
    dateOfBirth: initial?.dateOfBirth?.slice(0, 10) ?? "",
    country: initial?.country ?? "",
    city: initial?.city ?? "",
    ethnicity: initial?.ethnicity ?? "",
    languages: initial?.languages ?? [],
    madhhab: initial?.madhhab ?? "none",
    sect: initial?.sect ?? "sunni",
    prayerCommitment: initial?.prayerCommitment ?? "mostly",
    hijab: initial?.hijab ?? "na",
    beard: initial?.beard ?? "na",
    revert: initial?.revert ?? false,
    education: initial?.education ?? "bachelor",
    profession: initial?.profession ?? "",
    maritalHistory: initial?.maritalHistory ?? "never_married",
    hasChildren: initial?.hasChildren ?? false,
    wantsChildren: initial?.wantsChildren ?? "yes",
    bio: initial?.bio ?? "",
  };
}

export function ProfileForm({ initial }: { initial: ProfileFieldsRecord | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("profileForm");
  const tGenders = useTranslations("matrimonial.genders");
  const tMadhhabs = useTranslations("matrimonial.madhhabs");
  const tPrayer = useTranslations("matrimonial.prayer");
  const tHijab = useTranslations("matrimonial.hijab");
  const tBeard = useTranslations("matrimonial.beard");
  const tMarital = useTranslations("matrimonial.marital");
  const tWants = useTranslations("matrimonial.wantsChildren");
  const tEducation = useTranslations("matrimonial.education");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFieldsInput>({
    resolver: zodResolver(profileFieldsSchema),
    defaultValues: defaultsFrom(initial),
  });

  function onSubmit(values: ProfileFieldsInput) {
    startTransition(async () => {
      const result = await saveProfileFieldsAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("savedToast"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Section title={t("sections.identity")} description={t("sections.identityDescription")}>
        <Field label={t("displayName")} error={errors.displayName?.message}>
          <Input placeholder={t("displayNamePlaceholder")} {...register("displayName")} />
        </Field>
        <Field label={t("gender")} error={errors.gender?.message}>
          <Select {...register("gender")}>
            <option value="male">{tGenders("male")}</option>
            <option value="female">{tGenders("female")}</option>
          </Select>
        </Field>
        <Field label={t("dateOfBirth")} error={errors.dateOfBirth?.message}>
          <Input type="date" {...register("dateOfBirth")} />
        </Field>
        <Field label={t("country")} error={errors.country?.message}>
          <Controller
            name="country"
            control={control}
            render={({ field }) => (
              <CountryCombobox value={field.value ?? ""} onChange={field.onChange} />
            )}
          />
        </Field>
        <Field label={t("city")} error={errors.city?.message}>
          <Input {...register("city")} />
        </Field>
        <Field label={t("ethnicity")}>
          <Input {...register("ethnicity")} />
        </Field>
        <Field label={t("languages")} span="full">
          <Controller
            name="languages"
            control={control}
            render={({ field }) => (
              <LanguageCombobox
                multiple
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
      </Section>

      <Section title={t("sections.religion")}>
        <Field label={t("madhhab")}>
          <Select {...register("madhhab")}>
            {(["hanafi", "maliki", "shafii", "hanbali", "other", "none"] as const).map((m) => (
              <option key={m} value={m}>
                {tMadhhabs(m)}
              </option>
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
              <option key={p} value={p}>
                {tPrayer(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("hijab")}>
          <Select {...register("hijab")}>
            {(["niqab", "khimar", "shayla", "none", "na"] as const).map((h) => (
              <option key={h} value={h}>
                {tHijab(h)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("beard")}>
          <Select {...register("beard")}>
            {(["full", "trimmed", "none", "na"] as const).map((b) => (
              <option key={b} value={b}>
                {tBeard(b)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center gap-2 pt-2">
          <Checkbox id="revert" {...register("revert")} />
          <label htmlFor="revert" className="text-sm">
            {t("revert")}
          </label>
        </div>
      </Section>

      <Section title={t("sections.background")}>
        <Field label={t("education")}>
          <Select {...register("education")}>
            {(["high_school", "diploma", "bachelor", "master", "phd", "other"] as const).map(
              (e) => (
                <option key={e} value={e}>
                  {tEducation(e)}
                </option>
              ),
            )}
          </Select>
        </Field>
        <Field label={t("profession")}>
          <Input {...register("profession")} />
        </Field>
        <Field label={t("maritalHistory")}>
          <Select {...register("maritalHistory")}>
            {(["never_married", "divorced", "widowed"] as const).map((m) => (
              <option key={m} value={m}>
                {tMarital(m)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("wantsChildren")}>
          <Select {...register("wantsChildren")}>
            {(["yes", "no", "maybe"] as const).map((w) => (
              <option key={w} value={w}>
                {tWants(w)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center gap-2 pt-2 sm:col-span-2">
          <Checkbox id="hasChildren" {...register("hasChildren")} />
          <label htmlFor="hasChildren" className="text-sm">
            {t("hasChildren")}
          </label>
        </div>
      </Section>

      <Section title={t("sections.bio")} description={t("sections.bioDescription")}>
        <Field label={t("bio")} error={errors.bio?.message} span="full">
          <textarea
            rows={5}
            placeholder={t("bioPlaceholder")}
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
            {...register("bio")}
          />
        </Field>
      </Section>

      <div className="flex items-center justify-end gap-3">
        {isDirty && (
          <span className="text-xs text-muted-foreground">{t("unsavedChanges")}</span>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
