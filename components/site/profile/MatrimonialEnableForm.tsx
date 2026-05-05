"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { CountryCombobox } from "@/components/common/CountryCombobox";
import { MadhhabCombobox } from "@/components/common/MadhhabCombobox";
import { Section } from "./forms/Section";
import { Field } from "./forms/Field";
import { Select } from "./forms/Select";
import { AgeRangeField } from "./forms/AgeRangeField";
import {
  matrimonialFieldsSchema,
  type MatrimonialFieldsInput,
} from "@/lib/profile/schema";
import { enableMatrimonialAction } from "@/app/[locale]/(site)/profile/matrimonial/actions";

interface Props {
  defaultLookingFor?: "male" | "female";
}

export function MatrimonialEnableForm({ defaultLookingFor = "female" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("profileMatrimonial.enable");
  const tGenders = useTranslations("matrimonial.genders");
  const tPolygamy = useTranslations("matrimonial.polygamy");
  const tPrayer = useTranslations("matrimonial.prayer");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MatrimonialFieldsInput>({
    resolver: zodResolver(matrimonialFieldsSchema),
    defaultValues: {
      polygamyStance: "na",
      lookingForGender: defaultLookingFor,
      ageMin: 22,
      ageMax: 35,
      preferredCountries: [],
      preferredMadhhabs: [],
      prayerMin: "sometimes",
      polygamyAcceptable: "na",
      photoStubs: [],
    },
  });

  function onSubmit(values: MatrimonialFieldsInput) {
    startTransition(async () => {
      const result = await enableMatrimonialAction(values);
      if (!result.ok) {
        toast.error(result.error);
        if (result.missingProfile) router.push("/profile");
        return;
      }
      toast.success(t("enabledToast"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Section title={t("aboutYouTitle")} description={t("aboutYouDescription")}>
        <Field label={t("polygamyStance")}>
          <Select {...register("polygamyStance")}>
            {(["open", "neutral", "closed", "na"] as const).map((p) => (
              <option key={p} value={p}>
                {tPolygamy(p)}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section
        title={t("matchPreferencesTitle")}
        description={t("matchPreferencesDescription")}
      >
        <Field label={t("lookingForGender")}>
          <Select {...register("lookingForGender")}>
            <option value="male">{tGenders("male")}</option>
            <option value="female">{tGenders("female")}</option>
          </Select>
        </Field>
        <Field
          label={t("ageRange")}
          error={errors.ageMin?.message ?? errors.ageMax?.message}
        >
          <Controller
            control={control}
            name="ageMin"
            render={({ field: minField }) => (
              <Controller
                control={control}
                name="ageMax"
                render={({ field: maxField }) => (
                  <AgeRangeField
                    value={[minField.value, maxField.value]}
                    onChange={([lo, hi]) => {
                      minField.onChange(lo);
                      maxField.onChange(hi);
                    }}
                  />
                )}
              />
            )}
          />
        </Field>
        <Field label={t("preferredCountries")}>
          <Controller
            name="preferredCountries"
            control={control}
            render={({ field }) => (
              <CountryCombobox
                multiple
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        <Field label={t("preferredMadhhabs")}>
          <Controller
            name="preferredMadhhabs"
            control={control}
            render={({ field }) => (
              <MadhhabCombobox
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        <Field label={t("prayerMin")}>
          <Select {...register("prayerMin")}>
            {(["always", "mostly", "sometimes", "rarely", "learning"] as const).map((p) => (
              <option key={p} value={p}>
                {tPrayer(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("polygamyAcceptable")}>
          <Select {...register("polygamyAcceptable")}>
            {(["open", "neutral", "closed", "na"] as const).map((p) => (
              <option key={p} value={p}>
                {tPolygamy(p)}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("enabling") : t("enable")}
        </Button>
      </div>
    </form>
  );
}
