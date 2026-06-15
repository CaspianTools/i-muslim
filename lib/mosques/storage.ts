import "server-only";
import { randomBytes } from "node:crypto";
import { getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { requireDb } from "@/lib/firebase/admin";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
// Proof-of-authorization docs may be a scanned PDF in addition to a photo.
const ALLOWED_PROOF_MIME = new Set([...ALLOWED_IMAGE_MIME, "application/pdf"]);
const MAX_BYTES = 5 * 1024 * 1024;
const URL_TTL_MS = 15 * 60 * 1000;

function getBucketName(): string {
  const explicit = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (explicit) return explicit;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Storage bucket not configured");
  return `${projectId}.appspot.com`;
}

function getBucket() {
  // The admin app singleton is shared across the codebase. requireDb() also
  // initializes it as a side effect.
  requireDb();
  const app = getApps().find((a) => a.name === "i-muslim-admin");
  if (!app) throw new Error("Admin app missing");
  return getStorage(app).bucket(getBucketName());
}

export type MosqueUploadKind = "cover" | "logo" | "gallery" | "news" | "proof";

export interface MosqueUploadInput {
  /** Owning mosque slug — for an in-progress create/application, pass a temp id. */
  slug: string;
  /** Logical bucket within the mosque's folder (e.g. "cover", "logo"). */
  kind: MosqueUploadKind;
  filename: string;
  contentType: string;
  contentLength: number;
}

export interface MosqueUploadUrlResult {
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

function safeSlug(slug: string): string {
  const cleaned = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  return cleaned.replace(/^-+|-+$/g, "").slice(0, 80) || "_new";
}

export async function createMosqueUploadUrl(
  input: MosqueUploadInput,
): Promise<MosqueUploadUrlResult> {
  const allowed = input.kind === "proof" ? ALLOWED_PROOF_MIME : ALLOWED_IMAGE_MIME;
  if (!allowed.has(input.contentType)) {
    throw new Error(`Unsupported content type: ${input.contentType}`);
  }
  if (input.contentLength <= 0 || input.contentLength > MAX_BYTES) {
    throw new Error(`File size must be 1..${MAX_BYTES} bytes`);
  }
  const bucket = getBucket();
  const ts = Date.now();
  const slug = safeSlug(input.slug);
  // Proof-of-authorization docs are sensitive. Buckets that serve mosque media
  // publicly via the GCS URL would also expose proof if its path were guessable,
  // so prefix proof objects with an unguessable token (objects can't be listed
  // by anonymous callers, so obscurity + admin-only signed reads keeps them private).
  const prefix = input.kind === "proof" ? `${randomBytes(16).toString("hex")}-` : "";
  const storagePath = `mosques/${slug}/${input.kind}/${prefix}${ts}-${safeFilename(input.filename)}`;
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

/**
 * Mint a short-lived signed READ URL for a private object (e.g. an application
 * proof document under `mosques/<slug>/proof/`). Used by the admin review UI so
 * proof docs are never publicly listed/served.
 */
export async function createMosqueReadUrl(
  storagePath: string,
  ttlMs: number = URL_TTL_MS,
): Promise<string> {
  const [url] = await getBucket()
    .file(storagePath)
    .getSignedUrl({ version: "v4", action: "read", expires: Date.now() + ttlMs });
  return url;
}

export async function deleteMosqueStorageObject(storagePath: string): Promise<void> {
  try {
    await getBucket().file(storagePath).delete({ ignoreNotFound: true });
  } catch (err) {
    console.warn("[mosques/storage] delete failed:", err);
  }
}
