/**
 * Client-safe surface of the OG Bot persona.
 *
 * Only the bits the UI needs to render live here — quick-start chips and
 * shared types. The full system prompt, lexicon, foul-mouth rules and
 * songwriting playbook live in `og-persona.server.ts` and never ship to
 * the browser bundle (filename triggers Vite's server-only import
 * protection).
 */

export type OgMode = "safe" | "og";

export interface UserContextSummary {
  display_name: string | null;
  email: string | null;
  coin_balance: number;
  is_admin: boolean;
  is_vip: boolean;
  page_context?: string;
}

/**
 * Quick-start prompts surfaced in the chat empty state. Rendered as chips.
 */
export const QUICK_STARTS: { label: string; prompt: string }[] = [
  {
    label: "💬 Just chat",
    prompt: "Let's just chat. Ask me how I'm doing and we'll go from there.",
  },
  {
    label: "🧠 Give me advice",
    prompt:
      "I want some honest advice. Ask me what's on my mind first, then help me think it through.",
  },
  {
    label: "🎵 Write a song for someone",
    prompt:
      "Help me write a personalised song for someone in my life. Ask me who it's for, their name, their age or vibe, and how they want to be portrayed — then take it from there.",
  },
  {
    label: "🔎 Look something up",
    prompt:
      "I want to look something up. Ask me what I want to know and give me a clear answer.",
  },
];
