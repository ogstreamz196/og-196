/**
 * Extracts insult-like phrases from a user message so OG Bot can learn
 * fresh ammo and fire it back later. Pure / server-safe — no DB calls.
 *
 * Strategy: detect messages that contain known British/profanity seed words
 * OR appear to be name-calling at the bot ("you're a ...", "ya ...", etc),
 * then capture the offending phrase (1–5 words around the seed).
 */

// Seed dictionary of words that signal an insult is present. We only learn
// phrases that contain at least one of these — keeps junk out of the lexicon.
const SEED_WORDS = [
  "bell-end", "bellend", "pussyhole", "wanker", "knobhead", "plonker",
  "gobshite", "numpty", "tosser", "berk", "muppet", "pillock", "div",
  "wally", "melt", "twat", "git", "sod", "prat", "prick", "bastard",
  "bollocks", "arse", "arsehole", "dickhead", "wankstain", "shithead",
  "shitbag", "fuckwit", "fuckface", "asshat", "asshole", "moron",
  "idiot", "imbecile", "cretin", "loser", "dipshit", "dumbass", "jackass",
  "scrub", "tool", "clown", "donut", "weapon", "nonce", "muggy",
  "spanner", "gimp", "div", "doughnut", "muppetry", "stupid", "thick",
  "useless", "shit", "crap", "trash", "garbage", "rubbish",
  "bitch", "cunt", "fucker", "motherfucker", "fucking",
];

const SEED_SET = new Set(SEED_WORDS.map((w) => w.toLowerCase()));

const STOPWORDS = new Set([
  "you", "your", "youre", "you're", "ya", "u", "ur", "the", "a", "an",
  "is", "are", "am", "be", "to", "of", "and", "or", "but", "so",
  "this", "that", "it", "its", "im", "i", "me", "my", "we", "they",
  "what", "why", "how", "do", "does", "did", "really", "just", "very",
]);

const MAX_PHRASE_LEN = 60;
const MAX_PHRASE_WORDS = 6;
const MAX_PER_MESSAGE = 3;

function normaliseWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z'-]/g, "");
}

/**
 * Pull up to {@link MAX_PER_MESSAGE} insult phrases from a single user
 * message. Returns lower-cased, trimmed phrases ready for storage.
 */
export function extractInsults(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const clean = text.slice(0, 2000);
  // Split on punctuation/newlines so insults in different clauses are separate.
  const clauses = clean.split(/[.!?\n;]+/g);
  const found: string[] = [];

  for (const clause of clauses) {
    const tokens = clause.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) continue;

    // Find seed token index.
    let seedIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (SEED_SET.has(normaliseWord(tokens[i]))) {
        seedIdx = i;
        break;
      }
    }
    if (seedIdx === -1) continue;

    // Grow phrase: up to 2 descriptive words before seed, up to 2 after,
    // skipping stopwords on the edges.
    const start = Math.max(0, seedIdx - 2);
    const end = Math.min(tokens.length, seedIdx + 3);
    let slice = tokens.slice(start, end);

    // Trim stopwords on the edges.
    while (slice.length > 1 && STOPWORDS.has(normaliseWord(slice[0]))) slice.shift();
    while (slice.length > 1 && STOPWORDS.has(normaliseWord(slice[slice.length - 1]))) slice.pop();

    if (!slice.length) continue;
    if (slice.length > MAX_PHRASE_WORDS) slice = slice.slice(0, MAX_PHRASE_WORDS);

    const phrase = slice
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9'\- ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!phrase || phrase.length < 3 || phrase.length > MAX_PHRASE_LEN) continue;
    if (!found.includes(phrase)) found.push(phrase);
    if (found.length >= MAX_PER_MESSAGE) break;
  }

  return found;
}
