import "server-only";
import { getDb } from "@/lib/firebase/admin";
import { MOCK_CONTACT_MESSAGES } from "@/lib/admin/mock/contact-messages";
import type { ContactMessage, ContactMessageStatus } from "@/types/contact";

export const CONTACT_MESSAGES_COLLECTION = "contactMessages";

const STATUSES: ContactMessageStatus[] = ["open", "resolved"];

function asIso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (
    typeof v === "object" &&
    v &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function asOptionalIso(v: unknown): string | undefined {
  if (!v) return undefined;
  return asIso(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function normalizeContactMessage(
  id: string,
  raw: Record<string, unknown>,
): ContactMessage | null {
  if (!raw) return null;
  const message = asString(raw.message);
  const email = asString(raw.email);
  if (!message || !email) return null;

  const statusRaw = typeof raw.status === "string" ? raw.status : "open";
  const status: ContactMessageStatus = STATUSES.includes(statusRaw as ContactMessageStatus)
    ? (statusRaw as ContactMessageStatus)
    : "open";

  return {
    id,
    name: asString(raw.name, "Anonymous"),
    email,
    subject: asString(raw.subject, "(no subject)"),
    message,
    status,
    createdAt: asIso(raw.createdAt),
    resolvedAt: asOptionalIso(raw.resolvedAt),
    resolvedBy: asOptionalString(raw.resolvedBy),
    submitterIp: asOptionalString(raw.submitterIp),
    userAgent: asOptionalString(raw.userAgent),
    locale: asOptionalString(raw.locale),
  };
}

export type ContactMessagesResult = {
  messages: ContactMessage[];
  source: "firestore" | "mock";
};

export async function fetchContactMessages(): Promise<ContactMessagesResult> {
  const db = getDb();
  if (!db) return { messages: MOCK_CONTACT_MESSAGES, source: "mock" };
  try {
    const snap = await db
      .collection(CONTACT_MESSAGES_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    if (snap.empty) return { messages: [], source: "firestore" };
    const messages = snap.docs
      .map((d) => normalizeContactMessage(d.id, d.data() as Record<string, unknown>))
      .filter((m): m is ContactMessage => m !== null);
    return { messages, source: "firestore" };
  } catch (err) {
    console.warn("[admin/data/contact-messages] read failed:", err);
    return { messages: MOCK_CONTACT_MESSAGES, source: "mock" };
  }
}

export async function countOpenContactMessages(): Promise<number> {
  const db = getDb();
  if (!db) return MOCK_CONTACT_MESSAGES.filter((m) => m.status === "open").length;
  try {
    const snap = await db
      .collection(CONTACT_MESSAGES_COLLECTION)
      .where("status", "==", "open")
      .count()
      .get();
    return snap.data().count;
  } catch (err) {
    console.warn("[admin/data/contact-messages] count failed:", err);
    return 0;
  }
}
