import { z } from "zod";

export const contactSubmitSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(10).max(5000),
  locale: z.string().trim().max(10).optional(),
  website_url_secondary: z.string().optional(),
});

export type ContactSubmitInput = z.infer<typeof contactSubmitSchema>;
