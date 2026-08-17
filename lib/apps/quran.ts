/**
 * The i-muslim Quran Android app — the data behind /apps/quran.
 *
 * RELEASES below is a committed FALLBACK SNAPSHOT, not the live source. At
 * request time the site fetches the release history straight from the app
 * repo's play-assets/store-listing.html (lib/apps/quran-releases.ts, cached
 * one hour), so a new Play release appears on /apps/quran on its own — no
 * hand edit here. This snapshot renders only when that fetch can't
 * (QURAN_APP_REPO_TOKEN unset, GitHub outage, parse failure), so it may lag;
 * refresh it now and then by pasting in the newest entries. Two things are
 * still manual per release:
 *
 *   1. Screenshots: if they changed, re-run
 *      `npm run gen:app-shots -- --app quran` into
 *      public/apps/quran/shots/<versionCode>/ and bump shotSetVersionCode.
 *      Note the app repo only re-captures the full gallery occasionally; the
 *      later release-NN folders hold just that release's new feature shots.
 *   2. Privacy policy: if the release changes what the app does with data,
 *      update legal.privacy.app in all four locales (see CLAUDE.md).
 *
 * The release data drives /apps/quran, /apps/quran/changelog, the JSON-LD
 * softwareVersion / dateModified / releaseNotes, and the sitemap lastModified.
 *
 * Release notes stay English on purpose — only the newest release is translated
 * on Play, and moving the historical notes into messages/*.json would poison the
 * `check:locales` signal with permanently-untranslated keys.
 *
 * Versions that were never shipped to Play (1.0.41 / code 43, folded into
 * 1.0.42; and 1.0.37 / code 38, superseded before upload) are deliberately
 * absent — this is the public history, not the build log. The live fetch
 * applies the same rule by dropping `shipped:0` entries.
 */

import type { AppRelease } from "@/lib/apps/types";

export const QURAN_APP = {
  packageId: "com.imuslim.quran",
  playUrl: "https://play.google.com/store/apps/details?id=com.imuslim.quran",
  /** Which release the screenshots under public/apps/quran/shots/<n>/ came from. */
  shotSetVersionCode: 44,
} as const;

/** Newest first. Prepend new releases at the top. */
const RELEASES: AppRelease[] = [
  {
    version: "1.0.47",
    versionCode: 49,
    date: "2026-08-14",
    summary: "Keep the screen on while you read; long press a verse to open its actions; the verse you tapped is pointed out when it opens",
    note: "The screen now stays awake while you read, so a page does not go dark because you have not touched the phone. Your usual timeout returns as soon as you leave, and there is a switch in Settings.\n\nPress and hold anywhere on a verse to open its actions: bookmark, note, collection, copy, share. The button in the corner still works too.\n\nAnd a verse opened from the widget, a bookmark or a search is gently pointed out, so you can see the one you came for.",
  },
  {
    version: "1.0.46",
    versionCode: 48,
    date: "2026-08-09",
    summary: "The sajda mark opens the fifteen verses of prostration, and the widget takes every language you read",
    note: "The sajda mark now sits beside the verse number instead of trailing the Arabic, and it is easier to see. Tap it for all fifteen verses of prostration, then tap any one of them to read why that verse calls for a sajda, with the narration behind it and its reference.\n\nThe ayah widget now takes every language you read, not just one, and no longer cuts the translation short. Ayah of the day groups its verses by day, and the widget's buttons answer to a tap.",
  },
  {
    version: "1.0.45",
    versionCode: 47,
    date: "2026-08-09",
    summary: "Ayah of the day — a home-screen widget, and a history you can bookmark and annotate",
    note: "A new home-screen widget: an ayah of the day, in Arabic with the translation you read. Choose its language, background, text colour and text size when you add it, or change them later. Copy or share the verse straight from the widget, or tap for another one. Every verse it shows is kept under Ayah of the day in the menu, where you can bookmark it, add a note or save it to a collection like any other verse — and it travels with your backup.",
  },
  {
    version: "1.0.44",
    versionCode: 46,
    date: "2026-08-08",
    summary: "The surah name follows your reading language; the progress bar starts empty",
    note: "Two fixes in the reader. The surah name at the top of the screen now follows the language you read in, rather than always appearing in English, so it matches the title card below it. In Azerbaijani, surah 93 is now spelled Duha. And the thin progress line under the status bar now starts empty and fills as you scroll — before, it opened part-filled on short surahs, and completely full whenever a whole surah fitted on one screen.",
  },
  {
    version: "1.0.43",
    versionCode: 45,
    date: "2026-08-08",
    summary: "The surah-name arrow now returns to the surah list",
    note: "The arrow beside the surah name now always returns you to the list of surahs. Before, it simply retraced your steps: open a verse from a bookmark, a note, a collection or a search result, and the arrow dropped you back into that screen rather than the Quran itself — sometimes several taps from the list. Now one tap goes straight to all 114 surahs, wherever you came from. The phone's own back button still retraces your steps, as before.",
  },
  {
    version: "1.0.42",
    versionCode: 44,
    date: "2026-07-31",
    summary: "Decorated surah title card, and the mushaf reading flow",
    note: "Two changes to how a surah opens and reads. Every surah now begins on a decorated title card — the name in Arabic beside its spelling in whichever languages you read, with the surah's number and length below, tinted to suit your reading background. And with every translation turned off, the Arabic is now set the way a mushaf is printed: one continuous justified page, each verse closing in a traditional ornamental rosette holding its number.",
  },
  {
    version: "1.0.40",
    versionCode: 42,
    date: "2026-07-29",
    summary: "Notes on any ayah",
    note: "Write your own notes on any ayah. Open the menu beside a verse — the same one you use to copy or share — and tap Add note. Jot down a reflection, a reminder, something a teacher said. A small pen appears next to any verse you have written on, so you can reopen the note with one tap. Everything you have written is gathered under Notes in the menu; tap any entry to jump straight back to that verse. Notes stay on your device, are included in backup and restore, and work offline.",
  },
  {
    version: "1.0.39",
    versionCode: 41,
    date: "2026-07-29",
    summary: "One green ramp across the whole app",
    note: "A new look, in one colour. The app now wears a single family of greens, from the palest page tint to a deep olive, and every screen is drawn from it — buttons, headers, verse numbers, sliders and the reading progress line. Menus, sheets and dialogs picked up a stray lilac tint from Android's defaults before; they are now the same green as everything else. Dark mode is a deep forest green rather than plain grey. The app icon and opening screen match. Tajweed colours are untouched.",
  },
  {
    version: "1.0.38",
    versionCode: 40,
    date: "2026-07-29",
    summary: "Edge-to-edge and status-bar fixes",
    note: "Fixes for how the app meets the edges of your screen. Pick a reading background and the header now stays a solid sheet of that colour — verses no longer show through the surah name or the clock. In landscape, text keeps clear of the navigation bar and the camera cutout. The status bar icons follow the page you are on, so they stay readable on the night background. Search now opens as a sheet over what you were reading instead of taking you away from it.",
  },
  {
    version: "1.0.37",
    versionCode: 39,
    date: "2026-07-27",
    summary: "Latin transliteration of every ayah",
    note: "Can't read Arabic script? Now you can still recite. Turn on Transliteration — tap the surah name in the reader, or find it in Settings — and every ayah shows its Latin spelling right under the Arabic. It follows how the verse is actually recited: each one ends the way you say it when you stop, long vowels are held, and sun letters run together. Works fully offline like everything else, and copies and shares along with the ayah. No ads, no tracking.",
  },
  {
    version: "1.0.36",
    versionCode: 37,
    date: "2026-07-27",
    summary: "Google sign-in never fails silently",
    note: "Signing in with Google now works properly. Choosing your account completes the sign-in instead of quietly returning you to the same screen, and it no longer gives up if you take a moment to read the consent screen. Sign-in also survives rotating your phone or switching theme partway through. If anything does go wrong, the app now tells you what happened right on the screen rather than failing in silence.",
  },
  {
    version: "1.0.35",
    versionCode: 36,
    date: "2026-07-27",
    summary: "Scroll-driven reading progress bar",
    note: "See how far you have come. A slim progress line now sits at the top of the reader and fills as you scroll through a surah, so you always know how much is behind you and how much is left. Scroll back up and it follows you back. It stays in view even when the header tucks away, sits quietly on every reading background, and runs right to left when you read in Arabic.",
  },
  {
    version: "1.0.34",
    versionCode: 35,
    date: "2026-07-22",
    summary: "New app icon: the open mushaf mark",
    note: "New app icon. The Quran app now carries its own mark — an open mushaf on a rehal, in the familiar green — on a clean white rounded tile, so it is easy to pick out on your home screen and tells the Quran app apart from the other i-muslim apps at a glance. Nothing else changed: same offline Quran, same translations, same tajweed colours. No ads, no tracking.",
  },
  {
    version: "1.0.33",
    versionCode: 34,
    date: "2026-07-21",
    summary: "Translation picker on the title, tajweed rules explained",
    note: "Tap the surah name in the reader to switch translations on the spot — no more digging through Settings. Tajweed is now teachable: the legend opens full height, and tapping any rule explains how to pronounce it in your language, with a Quranic example showing which letters it colors. The reader reads calmer too — the surah title and Bismillah share the color of the verses, the frame echoes the verse-number green, and the lines between ayahs are softer.",
  },
  {
    version: "1.0.32",
    versionCode: 33,
    date: "2026-07-10",
    summary: "Credit i-muslim and Caspian Tools in About",
    note: "About us now credits both i-muslim (the publisher) and Caspian Tools (the developer), each with its own link — and makes clear this is our Quran app, while Prayer Times and Hadith are separate i-muslim apps. Small wording fix: the Profile note now says your stats stay on your device unless you turn on cloud backup. Reading stays fully offline; cloud backup is optional. No ads, no tracking.",
  },
  {
    version: "1.0.31",
    versionCode: 32,
    date: "2026-07-10",
    summary: "Profile sign-in, avatar and password reset",
    note: "Sign in right from your Profile: it now shows your Google photo and name and taps through to the same account screen as Settings — one place for cloud backup. Forgot your password? A new \"Forgot password?\" link emails you a reset link so you can get back in. We also made Google sign-in clearer when it can't complete. Reading stays fully offline — no ads, no account required, no tracking.",
  },
  {
    version: "1.0.30",
    versionCode: 31,
    date: "2026-07-03",
    summary: "Transliterated surah names inside the cartouche",
    note: "Tidier surah titles: the transliterated names (e.g. Hud / Худ / Hud) now sit together on one line inside the decorated title plate, right below the Arabic name — separated by a slash — instead of stacked loosely beneath the box. The whole heading reads as one neat unit. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.29",
    versionCode: 30,
    summary: "PakType Naskh, a fifth Arabic font",
    note: "New Arabic font: PakType Naskh — the sub-continental Naskh style widely read across Pakistan and Afghanistan. Choose it in Settings → Arabic font and the whole Quran renders in this familiar hand, with every vowel and pause mark kept in place. That's five fonts to pick from now: Amiri, Scheherazade New, Noto Naskh Arabic, KFGQPC Uthmanic, and PakType Naskh. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.28",
    versionCode: 29,
    summary: "Swipe between surahs",
    note: "New: swipe left or right in the reader to move between surahs. The surah page now slides under your finger and snaps into place, like turning the pages of a mushaf — no need to scroll to the bottom and tap Next. The direction follows your reading language, so it feels natural in both left-to-right and right-to-left. The Previous/Next buttons now glide the same way. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.27",
    versionCode: 28,
    summary: "Arabic verses right-aligned",
    note: "Arabic verse text is now right-aligned in the reader, matching the natural right-to-left reading side of a printed mushaf, so short ayahs no longer sit on the left. Applies to both plain and Tajweed-colored Arabic. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.26",
    versionCode: 27,
    summary: "Build system migration",
    note: "Maintenance update: migrated to the modern Android build system (Android Gradle Plugin 9's built-in Kotlin support) and cleared out deprecated build settings, keeping the project current and the app ready for future Android releases. No changes to features or your data — still fully offline, with no ads, no account, and no tracking.",
  },
  {
    version: "1.0.25",
    versionCode: 26,
    summary: "Contact email opens correctly on every mail app",
    note: "Fix: tapping the contact email on the About us page now pre-fills the subject and message on every mail app — not just Gmail. Some phone makers' built-in mail apps were opening a blank email; the app version, your device, and the note about which app you're writing about are now filled in reliably. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.24",
    versionCode: 25,
    summary: "Google sign-in reliability",
    note: "Google sign-in for cloud backup is more reliable. \"Continue with Google\" now shows its own progress and can no longer get stuck spinning forever — it times out gracefully, tells you clearly if no Google account is set up on your device, and uses Google's recommended sign-in flow. Cloud backup is still completely optional, and the app works fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.23",
    versionCode: 24,
    summary: "Pre-filled contact email",
    note: "Reaching us is easier. Tapping the contact email on the About us page now opens your mail app already filled in — the subject names the app and the message includes its version and your device, plus a note that this address is shared across all i-muslim apps, so your feedback reaches the right team faster. The pre-filled text follows your chosen app language. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.22",
    versionCode: 23,
    summary: "Tajweed colours follow whole letters",
    note: "Sharper Tajweed colors. Each color now follows the whole Arabic letter together with its vowel marks, so letters no longer look split into two colors or \"broken\" — coloring is clean and easy to read, just like a printed color mushaf. Tajweed colors are still optional and off by default, and everything works fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.21",
    versionCode: 22,
    summary: "Optional tajweed colours",
    note: "New: optional Tajweed colors. Turn it on in Settings to color-code the Arabic letters by tajweed rule — ghunnah, ikhfa, idgham, iqlab, qalqalah and the madd family — just like a printed color mushaf, to help you recite correctly. A legend button in the reader shows what each color means. It's completely optional and off by default, the colors adapt to your reading background, and everything still works fully offline.",
  },
  {
    version: "1.0.20",
    versionCode: 21,
    summary: "One set of thin-line icons",
    note: "Fresh new look: the whole app now uses a single, consistent set of clean thin-line icons. Menus, buttons and the verse actions feel lighter and more modern, and the icons mirror correctly for right-to-left Arabic. Nothing else changed — every feature works exactly as before. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.19",
    versionCode: 20,
    summary: "Decorated surah title banner",
    note: "New: a decorated surah title. Each surah now opens with an ornamental banner — a framed cartouche with the surah's number and verse count in side medallions and a crescent-and-star crest — drawn in our own style and tinted to match your reading background. The surah name now appears written in each translation language you've enabled (now including Russian, Turkish and Azerbaijani), instead of its meaning. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.18",
    versionCode: 19,
    summary: "Arabic fonts, word spacing, reading backgrounds",
    note: "Make the Quran your own. In Settings: choose your Arabic font — Amiri, Scheherazade New, Noto Naskh Arabic, or the familiar KFGQPC Uthmanic (Madinah mushaf); add a little space between Arabic words if they feel cramped; and pick a book-like reading background — paper, sepia, mushaf green, night, or black. Text colour adapts for contrast, applied to just the reader or the whole app. Still fully offline.",
  },
  {
    version: "1.0.17",
    versionCode: 18,
    summary: "Optional cloud backup",
    note: "New: optional cloud backup. Sign in (email or Google) from Settings → Cloud backup to save your bookmarks, collections and reading progress to your account, and restore them on a new phone in one tap. It's completely optional — the app still works fully offline with no account, and nothing leaves your device unless you sign in. The existing file-based backup is still there too.",
  },
  {
    version: "1.0.16",
    versionCode: 17,
    summary: "Translation follows your chosen language",
    note: "When you choose a language now, its translation loads automatically — pick Azerbaijani and you get the Azerbaijani translation alongside the Arabic, not English. We've also cleaned up the English translation: the small footnote reference numbers that used to appear at the end of verses are gone, so the text reads cleanly. You can still add or remove translations any time in Settings. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.15",
    versionCode: 16,
    summary: "Language sticks; back up and restore to a file",
    note: "Fixes the app showing in English after you picked another language (e.g. Azerbaijani) — every language is now bundled, so your choice always sticks. Your bookmarks, collections and reading streak now survive reinstalling the app, and a new \"Back up & restore\" in Settings lets you save your data to a file and bring it back any time or on a new phone. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.14",
    versionCode: 15,
    summary: "i-muslim crescent app icon",
    note: "The app icon is now the i-muslim crescent badge, matching our other apps and the Play Store listing. No changes to your data or the reading experience. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.13",
    versionCode: 14,
    summary: "Diyanet İşleri Turkish translation",
    note: "Updated the Turkish translation: it's now the Diyanet İşleri (Altuntaş & Şahin) meal, with combined verses split so each ayah shows its own translation — making it easier to read along verse by verse. Other languages are unchanged. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.12",
    versionCode: 13,
    summary: "Profile screen with reading stats",
    note: "New: a Profile screen with your reading stats. Open it from the ⋮ menu to see where you left off (with one-tap Continue), how much of the Quran you've read (surahs, juz, and pages), your reading streak and which days you read this week, your bookmarks and collections, plus achievement badges. It updates quietly as you read — and, like everything else, your stats stay on your device. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.11",
    versionCode: 12,
    summary: "About us page, bottom-sheet menu",
    note: "New: an \"About us\" page. Tap the ⋮ menu and choose \"About us\" to see the app version, what i-muslim is about, and ways to reach us. The ⋮ menu itself is also nicer now — it slides up from the bottom of the screen instead of in from the side, so it's easier to reach one-handed. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.10",
    versionCode: 11,
    summary: "Collections",
    note: "New: Collections. Group your favourite ayahs into your own named lists — \"Memorize\", \"Friday verses\", anything you like. Tap the ⋮ on any verse and choose \"Add to collection\" to save it (a verse can live in several collections at once), then open Collections from the side menu to read, rename, or remove. Bookmarks still work just as before. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.9",
    versionCode: 10,
    summary: "Faster start, less memory, Android 16 ready",
    note: "This update is under the hood: the app now starts more smoothly and uses less memory the first time it loads the Quran, and it's updated for the latest Android (Android 16). A few small refinements round things out. Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.8",
    versionCode: 9,
    summary: "Six UI languages, streamlined navigation",
    note: "Choose your language on first launch — the whole app now runs in English, Arabic (right-to-left), Turkish, Indonesian, and now Russian and Azerbaijani, changeable anytime in Settings. Navigation is streamlined too: the bottom bar is gone — Bookmarks sits in the top header beside Search, and a new menu (⋮) opens a side panel for Settings. Verse badges show the full reference (e.g. 5:1). Still fully offline — no ads, no account, no tracking.",
  },
  {
    version: "1.0.7",
    versionCode: 8,
    summary: "No release note was recorded for this version",
  },
  {
    version: "1.0.6",
    versionCode: 7,
    summary: "Refreshed Settings, translator credits",
    note: "Refreshed Settings: a cleaner, borderless theme switcher (System / Light / Dark), the font-size percentage now sits next to each label with a one-tap reset to default, and the Translations picker now names the translator behind each translation. Still fully offline — no ads, no account, and no tracking.",
  },
  {
    version: "1.0.5",
    versionCode: 6,
    summary: "Fixed a crash when opening search",
    note: "Fixed a crash that could occur when opening search from the header. Search now opens reliably and is ready for typing right away. Still fully offline — no ads, no account, and no tracking.",
  },
  {
    version: "1.0.4",
    versionCode: 5,
    summary: "One overflow menu per verse",
    note: "Cleaner verse layout: each verse now has a single overflow (⋮) button at the top that opens a tidy menu for Bookmark, Copy, and Share. Translator credit lines were removed for a calmer, less cluttered read. Still fully offline, with no ads, no account, and no tracking.",
  },
  {
    version: "1.0.3",
    versionCode: 4,
    summary: "Home header reads \"Quran\"",
    note: "The main screen header now reads \"Quran\" instead of \"Read\", for a clearer title on the home page. No changes to your data — still fully offline, with no ads, no account, and no tracking.",
  },
  {
    version: "1.0.2",
    versionCode: 3,
    summary: "Build tooling refresh",
    note: "Maintenance update: refreshed the app's build tooling (Gradle, Kotlin, and Android build system). No changes to features or your data — still fully offline, with no ads, no account, and no tracking.",
  },
  {
    version: "1.0.1",
    versionCode: 2,
    summary: "Smaller download, better crash diagnostics",
    note: "Smaller, faster download. Behind-the-scenes build improvements (code and resource shrinking) and better crash diagnostics. No changes to features or your data — still fully offline, with no ads, no account, and no tracking.",
  },
  {
    version: "1.0",
    versionCode: 1,
    summary: "Initial release",
    note: "Initial release. The complete Quran, offline: Uthmani Arabic with four translations (English, Russian, Azerbaijani, Turkish), instant search, bookmarks, last-read resume, adjustable Arabic font size, and light/dark themes. No ads, no account, no internet — ever.",
  },
];

/** Sorted defensively, so a hand-added entry in the wrong place still renders right. */
export const QURAN_APP_RELEASES: readonly AppRelease[] = [...RELEASES].sort(
  (a, b) => b.versionCode - a.versionCode,
);
