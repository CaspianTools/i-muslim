import { QURAN_RELEASES_TAG } from "@/lib/apps/quran-releases";
import { handleRevalidate } from "@/lib/apps/revalidate";

export const runtime = "nodejs";

/**
 * On-demand refresh of the /apps/quran release data (cache tag
 * `quran-app-releases`). See lib/apps/revalidate.ts for the auth contract.
 */
export async function POST(req: Request) {
  return handleRevalidate(req, QURAN_RELEASES_TAG);
}
