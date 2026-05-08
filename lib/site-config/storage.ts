import "server-only";
import { getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { requireDb } from "@/lib/firebase/admin";

export type SiteUploadKind = "logo" | "favicon" | "og" | "articlePlaceholder";

interface KindConstraints {
  allowed: ReadonlySet<string>;
  maxBytes: number;
}

const CONSTRAINTS: Record<SiteUploadKind, KindConstraints> = {
  logo: {
    allowed: new Set(["image/png", "image/svg+xml", "image/webp", "image/jpeg"]),
    maxBytes: 2 * 1024 * 1024,
  },
  favicon: {
    allowed: new Set(["image/x-icon", "image/vnd.microsoft.icon", "image/png", "image/svg+xml"]),
    maxBytes: 256 * 1024,
  },
  og: {
    allowed: new Set(["image/png", "image/jpeg", "image/webp"]),
    maxBytes: 4 * 1024 * 1024,
  },
  articlePlaceholder: {
    allowed: new Set(["image/png", "image/jpeg", "image/webp"]),
    maxBytes: 4 * 1024 * 1024,
  },
};

const URL_TTL_MS = 15 * 60 * 1000;

function getBucketName(): string {
  const explicit = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (explicit) return explicit;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Storage bucket not configured");
  // Firebase projects created after Oct 2024 default to <project>.firebasestorage.app
  // (the legacy .appspot.com bucket is not auto-provisioned). Match that.
  return `${projectId}.firebasestorage.app`;
}

function getBucket() {
  requireDb();
  const app = getApps().find((a) => a.name === "i-muslim-admin");
  if (!app) throw new Error("Admin app missing");
  return getStorage(app).bucket(getBucketName());
}

export interface SiteUploadInput {
  kind: SiteUploadKind;
  filename: string;
  contentType: string;
  contentLength: number;
}

export interface SiteUploadUrlResult {
  url: string;
  storagePath: string;
  expiresAt: string;
}

function safeFilename(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
  return cleaned.slice(-80);
}

export async function createSiteUploadUrl(
  input: SiteUploadInput,
): Promise<SiteUploadUrlResult> {
  const constraints = CONSTRAINTS[input.kind];
  if (!constraints) throw new Error(`Unknown upload kind: ${input.kind}`);
  if (!constraints.allowed.has(input.contentType)) {
    throw new Error(`Unsupported content type: ${input.contentType}`);
  }
  if (input.contentLength <= 0 || input.contentLength > constraints.maxBytes) {
    throw new Error(`File size must be 1..${constraints.maxBytes} bytes`);
  }
  const bucket = getBucket();
  const ts = Date.now();
  const storagePath = `site/branding/${input.kind}/${ts}-${safeFilename(input.filename)}`;
  const file = bucket.file(storagePath);
  const expires = Date.now() + URL_TTL_MS;
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires,
    contentType: input.contentType,
    extensionHeaders: { "content-length": String(input.contentLength) },
  });
  return {
    url,
    storagePath,
    expiresAt: new Date(expires).toISOString(),
  };
}

export function publicUrlFor(storagePath: string): string {
  const bucket = getBucketName();
  return `https://storage.googleapis.com/${bucket}/${encodeURI(storagePath)}`;
}

// Site branding (logo/favicon/og/article placeholder) is rendered via plain
// `https://storage.googleapis.com/...` URLs in <link rel="icon"> / <img>, which
// the GCS REST endpoint serves with no Firebase Storage rules in the loop —
// so the object itself needs an `allUsers: objectViewer` ACL or it 403s.
// Granting per-object public read only on these admin-uploaded site assets
// keeps everything else (user uploads, etc.) gated by Storage Rules.
export async function makeSiteAssetPublic(storagePath: string): Promise<void> {
  try {
    await getBucket().file(storagePath).makePublic();
  } catch (err) {
    console.warn("[site-config/storage] makePublic failed:", err);
    throw err;
  }
}

export async function deleteSiteStorageObject(storagePath: string): Promise<void> {
  try {
    await getBucket().file(storagePath).delete({ ignoreNotFound: true });
  } catch (err) {
    console.warn("[site-config/storage] delete failed:", err);
  }
}

export function constraintsFor(kind: SiteUploadKind): KindConstraints {
  return CONSTRAINTS[kind];
}
