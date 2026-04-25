import type { ContactMessage } from "@/types/contact";

const now = Date.now();

export const MOCK_CONTACT_MESSAGES: ContactMessage[] = [
  {
    id: "msg-1",
    name: "Aisha Khan",
    email: "aisha@example.com",
    subject: "Translation suggestion for Surah Al-Mulk",
    message:
      "Assalamu alaikum — I noticed verse 67:14 reads slightly differently from my Mushaf. Could you double-check the source? JazakAllah khair.",
    status: "open",
    createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
    locale: "en",
  },
  {
    id: "msg-2",
    name: "Yusuf Ahmed",
    email: "yusuf@example.com",
    subject: "Hijri date for Eid al-Adha",
    message:
      "The Hijri date showing on the home page seems off by a day for my region. I'm in Australia. Is this configurable?",
    status: "open",
    createdAt: new Date(now - 1000 * 60 * 60 * 22).toISOString(),
    locale: "en",
  },
  {
    id: "msg-3",
    name: "Maryam B.",
    email: "maryam@example.com",
    subject: "Thank you",
    message:
      "Just wanted to say jazakum Allahu khairan for building this. Using it daily for prayer times and Quran. May Allah accept your effort.",
    status: "resolved",
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
    resolvedAt: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
    resolvedBy: "fuad.jalilov@gmail.com",
    locale: "en",
  },
];
