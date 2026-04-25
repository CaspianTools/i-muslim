import "server-only";
import {
  listInterests,
  listProfiles,
  listReports,
  type StoreSource,
} from "@/lib/matrimonial/store";
import type {
  MatrimonialInterest,
  MatrimonialProfile,
  MatrimonialReport,
} from "@/types/matrimonial";

export type AdminMatrimonialResult = {
  profiles: MatrimonialProfile[];
  interests: MatrimonialInterest[];
  reports: MatrimonialReport[];
  source: StoreSource;
};

export async function fetchAdminMatrimonial(): Promise<AdminMatrimonialResult> {
  const { profiles, source } = await listProfiles();
  const [interests, reports] = await Promise.all([listInterests(), listReports()]);
  return { profiles, interests, reports, source };
}
