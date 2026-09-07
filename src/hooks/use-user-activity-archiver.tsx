import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Subscribes to the signed-in user's `songs` rows. When a song flips to a
 * final/completed status (and is NOT a preview/variation), archives the MP3
 * to Drive and refreshes the user's Sheets tab. Fire-and-forget; failures
 * are logged but never block the UI.
 */
export function UserActivityArchiver() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`song-archive:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "songs", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as {
            id: string;
            status?: string | null;
            is_variation?: boolean | null;
            audio_path?: string | null;
          };
          const prev = payload.old as { status?: string | null };
          const becameFinal =
            (row.status === "complete" || row.status === "completed") &&
            prev?.status !== row.status;
          if (!becameFinal) return;
          if (row.is_variation) return; // previews skipped
          if (!row.audio_path) return;
          try {
            const drive = await import("@/lib/drive-archive.functions");
            await drive.archiveSongToDrive({ data: { songId: row.id } });
            const m = await import("@/lib/user-log.functions");
            await m.syncUserActivity({ data: {} });
          } catch (e) {
            console.error("song archive failed", e);
          }

        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}
