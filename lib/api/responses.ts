import "server-only";
import { NextResponse } from "next/server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "X-API-Key, Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

export function apiOk<T>(
  data: T,
  init?: { status?: number; headers?: Record<string, string> },
): NextResponse {
  return NextResponse.json({ data }, { status: init?.status ?? 200, headers: init?.headers });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  extraHeaders?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: extraHeaders },
  );
}

export function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export function corsPreflight(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
