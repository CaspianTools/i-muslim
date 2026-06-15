import type { Denomination } from "@/types/mosque";

export type MosqueApplicationKind = "claim" | "register";

export type MosqueApplicationStatus = "pending" | "approved" | "rejected";

/**
 * Uploaded proof of authorization (authorization letter, ID, masjid signage,
 * etc.) attached to an application. Stored under `mosques/<slug-or-temp>/proof/`
 * in Firebase Storage and read only via short-lived signed URLs in the admin
 * review UI — never publicly listed.
 */
export interface MosqueApplicationProof {
  url: string;
  storagePath: string;
  contentType: string;
  filename?: string;
}

/**
 * Minimal masjid details captured when a user REGISTERS a brand-new masjid that
 * isn't yet in the directory. On approval an admin creates the `mosques/<slug>`
 * doc (status `claimed_draft`) from these and the manager fills in the rest.
 */
export interface ProposedMosque {
  name: string;
  denomination?: Denomination;
  city: string;
  country: string; // ISO-3166 alpha-2
  location: { lat: number; lng: number };
  timezone: string; // IANA
  address?: string;
}

export interface MosqueApplication {
  id: string;
  kind: MosqueApplicationKind;
  /** Set for "claim" — the existing mosque slug being claimed. */
  mosqueSlug?: string;
  /** Set for "register" — the proposed new masjid. */
  proposedMosque?: ProposedMosque;
  applicant: { uid: string; email: string; name: string | null };
  proofDoc: MosqueApplicationProof;
  message?: string;
  status: MosqueApplicationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  /** For approved "register" applications — the slug of the mosque that got created. */
  createdMosqueSlug?: string;
  createdAt: string;
  updatedAt: string;
}
