import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { hashApiKey, isApiKeyShape } from "@/lib/api/keys";
import { checkRateLimit, rateLimitHeaders, type RateLimitResult } from "@/lib/api/rate-limiter";
import { apiError } from "@/lib/api/responses";
import type { ApiPermission, ApiScope } from "@/types/api";

export const API_KEYS_COLLECTION = "apiKeys";

export interface ApiKeyAuthSuccess {
  authenticated: true;
  keyId: string;
  keyName: string;
  keyPrefix: string;
  scopes: ApiScope[];
  permissions: ApiPermission[];
  rateLimit: RateLimitResult;
}

export interface ApiKeyAuthFailure {
  authenticated: false;
  error: NextResponse;
}

export type ApiKeyAuthResult = ApiKeyAuthSuccess | ApiKeyAuthFailure;

export async function validateApiKey(
  req: NextRequest | Request,
  requiredScope: ApiScope,
  requiredPermission: ApiPermission,
): Promise<ApiKeyAuthResult> {
  const apiKey = req.headers.get("X-API-Key") ?? req.headers.get("x-api-key");

  if (!apiKey) {
    return {
      authenticated: false,
      error: apiError("MISSING_API_KEY", "X-API-Key header is required", 401),
    };
  }

  if (!isApiKeyShape(apiKey)) {
    return {
      authenticated: false,
      error: apiError("INVALID_API_KEY", "Invalid API key format", 401),
    };
  }

  const rateLimit = checkRateLimit(apiKey);
  if (!rateLimit.allowed) {
    return {
      authenticated: false,
      error: apiError(
        "RATE_LIMITED",
        "Too many requests",
        429,
        rateLimitHeaders(rateLimit),
      ),
    };
  }

  const keyHash = hashApiKey(apiKey);
  const db = requireDb();

  const snap = await db
    .collection(API_KEYS_COLLECTION)
    .where("keyHash", "==", keyHash)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (snap.empty) {
    return {
      authenticated: false,
      error: apiError("INVALID_API_KEY", "API key not found or revoked", 401),
    };
  }

  const doc = snap.docs[0];
  const data = doc.data() as {
    name: string;
    keyPrefix: string;
    scopes: ApiScope[];
    permissions: ApiPermission[];
    expiresAt: FirebaseFirestore.Timestamp | null;
  };

  if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
    return {
      authenticated: false,
      error: apiError("EXPIRED_API_KEY", "API key has expired", 401),
    };
  }

  const scopes = data.scopes ?? [];
  if (!scopes.includes("*") && !scopes.includes(requiredScope)) {
    return {
      authenticated: false,
      error: apiError(
        "INSUFFICIENT_SCOPE",
        `This key does not have access to '${requiredScope}'`,
        403,
      ),
    };
  }

  const permissions = data.permissions ?? [];
  if (!permissions.includes(requiredPermission)) {
    return {
      authenticated: false,
      error: apiError(
        "INSUFFICIENT_PERMISSION",
        `This key does not have '${requiredPermission}' permission`,
        403,
      ),
    };
  }

  doc.ref
    .update({
      lastUsedAt: FieldValue.serverTimestamp(),
      requestCount: FieldValue.increment(1),
    })
    .catch(() => {});

  return {
    authenticated: true,
    keyId: doc.id,
    keyName: data.name,
    keyPrefix: data.keyPrefix,
    scopes,
    permissions,
    rateLimit,
  };
}
