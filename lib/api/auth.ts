import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, requireDb } from "@/lib/firebase/admin";
import { hashApiKey, isApiKeyShape } from "@/lib/api/keys";
import { checkRateLimit, rateLimitHeaders, type RateLimitResult } from "@/lib/api/rate-limiter";
import { apiError } from "@/lib/api/responses";
import type { ApiPermission, ApiScope } from "@/types/api";

export const API_KEYS_COLLECTION = "apiKeys";

export interface ApiKeyAuthSuccess {
  authenticated: true;
  via: "apiKey";
  keyId: string;
  keyName: string;
  keyPrefix: string;
  scopes: ApiScope[];
  permissions: ApiPermission[];
  rateLimit: RateLimitResult;
}

export interface BearerAuthSuccess {
  authenticated: true;
  via: "bearer";
  uid: string;
  email: string | null;
  scopes: ApiScope[];
  permissions: ApiPermission[];
  rateLimit: RateLimitResult;
}

export interface ApiKeyAuthFailure {
  authenticated: false;
  error: NextResponse;
}

export type ApiKeyAuthResult = ApiKeyAuthSuccess | ApiKeyAuthFailure;
export type ApiAuthResult =
  | ApiKeyAuthSuccess
  | BearerAuthSuccess
  | ApiKeyAuthFailure;

/**
 * Mobile / first-party native client short-circuit. Verifies a Firebase ID
 * token from the Authorization: Bearer header. Returns null if no token or
 * verification fails (the caller should then try API-key auth).
 *
 * Granted permissions are READ-ONLY here. Writes for signed-in users go
 * through dedicated /api/v1/me/* routes that use `getApiCallerSession`
 * directly, not validateApiKey/validateApiAccess.
 */
async function tryBearer(
  req: Request,
): Promise<BearerAuthSuccess | null> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (token.length === 0) return null;

  const auth = getAdminAuth();
  if (!auth) return null;
  try {
    const decoded = await auth.verifyIdToken(token, true);
    return {
      authenticated: true,
      via: "bearer",
      uid: decoded.uid,
      email: decoded.email ?? null,
      scopes: ["*"],
      permissions: ["read"],
      rateLimit: { allowed: true, remaining: -1, limit: -1, resetAt: 0 },
    };
  } catch {
    return null;
  }
}

/**
 * Authorize a request via either Bearer ID-token (mobile / signed-in users)
 * OR an API key. Use this for read endpoints that should be reachable by
 * mobile without provisioning a public API key for the app. Existing admin
 * write routes should keep using `validateApiKey` directly.
 */
export async function validateApiAccess(
  req: NextRequest | Request,
  requiredScope: ApiScope,
  requiredPermission: ApiPermission,
): Promise<ApiAuthResult> {
  const bearer = await tryBearer(req);
  if (bearer) {
    if (!bearer.permissions.includes(requiredPermission)) {
      return {
        authenticated: false,
        error: apiError(
          "INSUFFICIENT_PERMISSION",
          `Signed-in users have '${bearer.permissions.join(",")}' on /api/v1/*; use /api/v1/me/* for write actions.`,
          403,
        ),
      };
    }
    void requiredScope; // Bearer success grants all scopes; arg kept for future role checks.
    return bearer;
  }
  return validateApiKey(req, requiredScope, requiredPermission);
}

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
    via: "apiKey",
    keyId: doc.id,
    keyName: data.name,
    keyPrefix: data.keyPrefix,
    scopes,
    permissions,
    rateLimit,
  };
}
