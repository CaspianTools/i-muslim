import { PRAYER_RELEASES_TAG } from "@/lib/apps/prayer-releases";
import { handleRevalidate } from "@/lib/apps/revalidate";

export const runtime = "nodejs";

/**
 * On-demand refresh of the /apps/prayer release data (cache tag
 * `prayer-app-releases`). See lib/apps/revalidate.ts for the auth contract.
 */
export async function POST(req: Request) {
  return handleRevalidate(req, PRAYER_RELEASES_TAG);
}
