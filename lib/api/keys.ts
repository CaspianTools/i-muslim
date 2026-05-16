import "server-only";
import { randomBytes, createHash } from "crypto";

const KEY_PREFIX = "im_live_";
const KEY_PREFIX_DISPLAY_LEN = 16;

export function generateApiKey(): string {
  return `${KEY_PREFIX}${randomBytes(48).toString("base64url")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function getKeyPrefix(key: string): string {
  return key.substring(0, KEY_PREFIX_DISPLAY_LEN);
}

export function isApiKeyShape(value: string): boolean {
  return value.startsWith(KEY_PREFIX);
}

export { KEY_PREFIX, KEY_PREFIX_DISPLAY_LEN };
