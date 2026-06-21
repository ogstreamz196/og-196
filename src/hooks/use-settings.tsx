import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  coins_per_generation: number;
  coins_per_lyrics_generation: number;
  coins_per_full_unlock: number;
  songs_per_generation: number;
  sample_seconds: number;
  signup_credits: number;
};

const DEFAULTS: AppSettings = {
  coins_per_generation: 3,
  coins_per_lyrics_generation: 1,
  coins_per_full_unlock: 5,
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
      return {
        coins_per_generation: numOrDefault(map.coins_per_generation, DEFAULTS.coins_per_generation),
        coins_per_lyrics_generation: numOrDefault(map.coins_per_lyrics_generation, DEFAULTS.coins_per_lyrics_generation),
        coins_per_full_unlock: numOrDefault(map.coins_per_full_unlock, DEFAULTS.coins_per_full_unlock),
        songs_per_generation: numOrDefault(map.songs_per_generation, DEFAULTS.songs_per_generation),
        sample_seconds: numOrDefault(map.sample_seconds, DEFAULTS.sample_seconds),
        signup_credits: numOrDefault(map.signup_credits, DEFAULTS.signup_credits),
      };
    },
  });
}
