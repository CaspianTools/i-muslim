import { fetchPublicEvent } from "@/lib/events/public";
import { buildIcs } from "@/lib/events/ics";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const event = await fetchPublicEvent(id);
  if (!event) {
    return new Response("Event not found", { status: 404 });
  }
  const origin = new URL(request.url).origin;
  const ics = buildIcs(event, origin);
  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.id}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
