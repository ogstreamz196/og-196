import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecentSong {
  id: string;
  title: string | null;
  prompt: string;
  status: string;
  cover_url: string | null;
  created_at: string;
}

export function useRecentSongs(userId: string | undefined, limit = 6) {
  return useQuery({
    queryKey: ["recent-songs-home", userId, limit],
    enabled: !!userId,
    queryFn: async (): Promise<RecentSong[]> => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, prompt, status, cover_url, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as RecentSong[];
    },
  });
}
