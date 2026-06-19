// Maps each "creatable" entity (the QuickCreate / UAPOP item ids, also used by
// the per-page "New X" buttons) to the permission its create server action
// requires. Single source of truth so the palette, the "+" trigger, and every
// "New" button gate identically. The server actions remain the real backstop
// (each calls `requirePermission("<resource>.write")`); this only governs which
// create affordances are shown.

import type { Permission } from "@/lib/permissions/catalog";

export type CreatableType =
  | "event"
  | "business"
  | "mosque"
  | "article"
  | "articleCategory"
  | "eventCategory"
  | "businessCategory"
  | "businessAmenity"
  | "businessCertBody"
  | "mosqueFacility";

export const CREATE_PERMISSION: Record<CreatableType, Permission> = {
  event: "events.write",
  eventCategory: "events.write",
  business: "businesses.write",
  businessCategory: "businesses.write",
  businessAmenity: "businesses.write",
  businessCertBody: "businesses.write",
  mosque: "mosques.write",
  mosqueFacility: "mosques.write",
  article: "articles.write",
  articleCategory: "articles.write",
};
