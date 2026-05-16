export const API_SCOPES = [
  "*",
  "prayer-times",
  "qibla",
  "hijri",
  "mosques",
  "quran",
  "hadith",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const API_PERMISSIONS = ["read", "write", "delete"] as const;
export type ApiPermission = (typeof API_PERMISSIONS)[number];

export const API_KEY_STATUSES = ["active", "revoked"] as const;
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number];

export interface ApiKeyDto {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiScope[];
  permissions: ApiPermission[];
  status: ApiKeyStatus;
  createdBy: string;
  createdByEmail: string;
  requestCount: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ApiKeyCreatedDto extends ApiKeyDto {
  key: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
