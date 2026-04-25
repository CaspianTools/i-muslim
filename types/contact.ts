export type ContactMessageStatus = "open" | "resolved";

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  submitterIp?: string;
  userAgent?: string;
  locale?: string;
}
