import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  coins_per_generation: number;
  coins_per_lyrics_generation: number;
  coins_per_full_unlock: number;
  coins_per_lyric_video: number;
  coins_per_variation_divisor: number;
  songs_per_generation: number;
  sample_seconds: number;
  signup_credits: number;
};

const DEFAULTS: AppSettings = {
  coins_per_generation: 3,
  coins_per_lyrics_generation: 3,
  coins_per_full_unlock: 5,
  coins_per_lyric_video: 5,
  coins_per_variation_divisor: 2,
  songs_per_generation: 2,
  sample_seconds: 30,
  signup_credits: 5,
};

export function useSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    staleTime: 30_000,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase.from("app_settings").select("key, value");
      if (error) throw error;
      const map: Record<string, unknown> = {};
      for (const row of data ?? []) map[row.key] = row.value;
      const numOrDefault = (v: unknown, d: number) =>
        typeof v === "number" ? v : (typeof v === "string" && Number.isFinite(Number(v)) ? Number(v) : d);
      // Materialize the shape from DEFAULTS so the table-driven approach replaces
      // the previous per-field copy/paste — adding a new setting now means one
      // line in DEFAULTS and nothing else.
      const out = { ...DEFAULTS };
      for (const key of Object.keys(DEFAULTS) as (keyof AppSettings)[]) {
        out[key] = numOrDefault(map[key], DEFAULTS[key]);
      }
      return out;
    },
  });
}
