import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicSharedTrack = {
  id: string;
  title: string;
  lyrics: string | null;
  audioUrl: string;
};

export const getPublicSharedTrack = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ songId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<PublicSharedTrack | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: song, error } = await supabaseAdmin
      .from("songs")
      .select("id,title,lyrics,audio_path,status,is_public,revealed")
      .eq("id", data.songId)
      .eq("status", "completed")
      .eq("is_public", true)
      .neq("revealed", false)
      .maybeSingle();

    if (error || !song?.audio_path) return null;

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("song-files")
      .createSignedUrl(song.audio_path, 60 * 60);
    if (signError || !signed?.signedUrl) return null;

    return {
      id: song.id,
      title: song.title || "OG BOT track",
      lyrics: song.lyrics,
      audioUrl: signed.signedUrl,
    };
  });