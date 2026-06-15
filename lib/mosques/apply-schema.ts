import { z } from "zod";

export const proofDocSchema = z.object({
  url: z.string().url(),
  storagePath: z.string().min(1),
  contentType: z.string().min(1),
  filename: z.string().optional(),
});

export const proposedMosqueSchema = z.object({
  name: z.string().min(2).max(120),
  denomination: z
    .enum(["sunni", "shia", "ibadi", "ahmadi", "other", "unspecified"])
    .optional(),
  city: z.string().min(1).max(80),
  country: z.string().length(2).regex(/^[A-Za-z]{2}$/),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  timezone: z.string().min(2),
  address: z.string().max(200).optional(),
});

export const mosqueApplicationSchema = z
  .object({
    kind: z.enum(["claim", "register"]),
    mosqueSlug: z.string().min(1).max(120).optional(),
    proposedMosque: proposedMosqueSchema.optional(),
    message: z.string().max(1000).optional(),
    proofDoc: proofDocSchema,
  })
  .refine((v) => (v.kind === "claim" ? Boolean(v.mosqueSlug) : true), {
    message: "A masjid must be selected to claim.",
    path: ["mosqueSlug"],
  })
  .refine((v) => (v.kind === "register" ? Boolean(v.proposedMosque) : true), {
    message: "Masjid details are required to register a new masjid.",
    path: ["proposedMosque"],
  });

export type MosqueApplicationInput = z.infer<typeof mosqueApplicationSchema>;
