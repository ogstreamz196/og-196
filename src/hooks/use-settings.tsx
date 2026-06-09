import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  coins_per_generation: number;
  songs_per_generation: number;
  sample_seconds: number;
};

const DEFAULTS: AppSettings = {
  coins_per_generation: 3,
  songs_per_generation: 2,
  sample_seconds: 30,
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
      return {
        coins_per_generation: typeof map.coins_per_generation === "number" ? map.coins_per_generation : DEFAULTS.coins_per_generation,
        songs_per_generation: typeof map.songs_per_generation === "number" ? map.songs_per_generation : DEFAULTS.songs_per_generation,
        sample_seconds: typeof map.sample_seconds === "number" ? map.sample_seconds : DEFAULTS.sample_seconds,
      };
    },
  });
}
