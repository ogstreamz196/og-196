/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SEEDS HUB — single source of truth for all seed data in the project.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Anything that "seeds" the UI or the AI (taxonomies, presets, example
 * prompts, persona, quick-starts, learning dictionaries) is either DEFINED
 * here or RE-EXPORTED from its canonical home so you only have to look in
 * one file to audit / port / translate / hand off to another workspace.
 *
 * Adding a new seed?  Put the array here OR re-export it from below.
 * Don't sprinkle constants across components.
 */

// ─── OG Bot persona + chat quick-starts ──────────────────────────────────────
// The sensitive parts (system prompt, lexicon, foul-mouth rules, songwriting
// playbook) live in `src/lib/og-persona.server.ts` and are NOT re-exported
// here — they must never reach the client bundle.
//   → src/lib/og-persona.server.ts        (buildSystemPrompt, detectSongIntent — server-only)
//   → src/lib/insult-learner.server.ts    (extractInsults, SEED_WORDS — server-only)
// Client-safe surface only:
export { QUICK_STARTS } from "@/lib/og-persona-public";
export type { OgMode } from "@/lib/og-persona-public";

// ─── Song-creation taxonomies ────────────────────────────────────────────────
// Canonical home (today): src/components/library/CreateSongDialog.tsx
// Mirrored here so they can be imported anywhere without coupling to a
// component file. Keep both in sync if you edit.
export const SONG_MOODS = [
  "Warm", "Hopeful", "Heartfelt", "Hype", "Sad", "Romantic",
  "Nostalgic", "Chill", "Triumphant", "Cheeky",
] as const;

export const SONG_GENRES = [
  "Rap", "Drill", "Pop", "Afrobeats", "R&B", "Dance",
  "Acoustic", "Ballad", "Reggae", "Indie",
] as const;

export const SONG_STYLES = [
  "Story-driven", "Punchy bars", "Sing-along hook",
  "Spoken word", "Anthem", "Lullaby",
] as const;

export const SONG_RELATIONSHIPS = [
  "Mum", "Dad", "Partner", "Best friend", "Sibling",
  "Kids", "Crew", "Myself",
] as const;

export const SONG_LANGUAGES = [
  "English", "Spanish", "French", "Portuguese", "Hindi", "Gujarati",
  "Marathi", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam",
  "Urdu", "Punjabi", "Arabic", "Swahili", "Patois", "Yoruba", "German",
  "Italian", "Tagalog",
] as const;

export const SONG_THEMES = [
  "A love letter that finally says it out loud",
  "Roast them with love on their birthday",
  "A tribute to someone we lost too soon",
  "Hometown pride — where I'm from made me",
  "Glow-up anthem after a tough year",
  "Late-night drive, windows down, no worries",
  "Apology song that actually means it",
  "Best friend appreciation, every inside joke",
  "Wedding day vows turned into a hook",
  "Underdog story — they doubted me, watch this",
  "Mum's strength, told the way she'd never tell it",
  "First-day-at-a-new-job hype track",
] as const;

// Extended OG Bot language list (messenger UI).
// Canonical home: inline in src/components/messenger/OgChat.tsx — kept here
// in case you want one global list across both surfaces.
export const OG_BOT_LANGUAGES = [
  "English", "Spanish", "French", "Portuguese", "Hindi", "Gujarati",
  "Marathi", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam",
  "Urdu", "Punjabi", "Arabic", "Swahili", "Patois", "Yoruba", "German",
  "Italian", "Filipino", "Tagalog", "Cebuano", "Mandarin", "Japanese",
  "Korean", "Turkish", "Russian", "Polish", "Dutch", "Greek", "Thai",
  "Vietnamese", "Indonesian", "Malay", "Hebrew",
] as const;

// ─── Song-creation one-tap presets ───────────────────────────────────────────
export type SongPreset = {
  label: string;
  emoji: string;
  values: {
    mood: (typeof SONG_MOODS)[number];
    genre: (typeof SONG_GENRES)[number];
    lyricalStyle: (typeof SONG_STYLES)[number];
    theme: (typeof SONG_THEMES)[number];
  };
};

export const SONG_PRESETS: SongPreset[] = [
  { label: "Birthday hype",   emoji: "🎉", values: { mood: "Hype",       genre: "Afrobeats", lyricalStyle: "Sing-along hook", theme: "Roast them with love on their birthday" } },
  { label: "Love letter",     emoji: "💌", values: { mood: "Romantic",   genre: "R&B",       lyricalStyle: "Story-driven",    theme: "A love letter that finally says it out loud" } },
  { label: "In memory",       emoji: "🕊️", values: { mood: "Heartfelt", genre: "Ballad",    lyricalStyle: "Story-driven",    theme: "A tribute to someone we lost too soon" } },
  { label: "Hometown anthem", emoji: "🏟️", values: { mood: "Triumphant",genre: "Drill",     lyricalStyle: "Anthem",          theme: "Hometown pride — where I'm from made me" } },
  { label: "Chill vibes",     emoji: "🌊", values: { mood: "Chill",      genre: "Indie",     lyricalStyle: "Spoken word",     theme: "Late-night drive, windows down, no worries" } },
  { label: "Glow-up",         emoji: "✨", values: { mood: "Triumphant", genre: "Pop",       lyricalStyle: "Anthem",          theme: "Glow-up anthem after a tough year" } },
  { label: "Wedding day",     emoji: "💍", values: { mood: "Romantic",   genre: "Acoustic",  lyricalStyle: "Story-driven",    theme: "Wedding day vows turned into a hook" } },
  { label: "Apology",         emoji: "🙏", values: { mood: "Heartfelt",  genre: "R&B",       lyricalStyle: "Spoken word",     theme: "Apology song that actually means it" } },
  { label: "Best friend",     emoji: "🤝", values: { mood: "Warm",       genre: "Pop",       lyricalStyle: "Sing-along hook", theme: "Best friend appreciation, every inside joke" } },
  { label: "Underdog",        emoji: "🥊", values: { mood: "Hype",       genre: "Rap",       lyricalStyle: "Punchy bars",     theme: "Underdog story — they doubted me, watch this" } },
  { label: "For Mum",         emoji: "🌷", values: { mood: "Nostalgic",  genre: "Ballad",    lyricalStyle: "Story-driven",    theme: "Mum's strength, told the way she'd never tell it" } },
  { label: "Heartbreak",      emoji: "💔", values: { mood: "Sad",        genre: "R&B",       lyricalStyle: "Story-driven",    theme: "A love letter that finally says it out loud" } },
];

// ─── Library "Describe your song" example chips ─────────────────────────────
// Shown under the song description textarea to spark ideas.
export type DescribeChip = { label: string; snippet: string };

export const LIBRARY_DESCRIBE_CHIPS: DescribeChip[] = [
  { label: "💛 Heart of gold",       snippet: "They've got a heart of gold — " },
  { label: "🎉 Life of the party",   snippet: "Always the life of the party — " },
  { label: "🫶 Always there for me", snippet: "Always there for me when — " },
  { label: "🔥 Total legend",        snippet: "An absolute legend because — " },
];

// ─────────────────────────────────────────────────────────────────────────────
//  WHERE EVERYTHING LIVES (port checklist for new workspaces)
// ─────────────────────────────────────────────────────────────────────────────
//  - This file                              → all UI seed taxonomies + chips
//  - src/lib/og-persona.ts                  → OG Bot persona + quick-starts
//  - src/lib/insult-learner.ts              → insult seed dictionary
//  - src/lib/og-messenger.functions.ts      → server prompt assembly
//  - src/components/library/CreateSongDialog.tsx → song-creation UI (uses
//                                              the SONG_* arrays above)
//  - supabase/migrations/                   → database schema + RLS
// ─────────────────────────────────────────────────────────────────────────────
