// Issues a short-lived signed URL for the owner of a song to stream/download the audio file.
// Modes:
//   - "preview" (default): always allowed for the owner; client enforces sample-seconds cap.
//   - "full": only allowed when the song has been unlocked (e.g. paid / VIP grant).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return j({ error: "Missing auth" }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return j({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const song_id: string | undefined = body?.song_id;
  const mode: "preview" | "full" = body?.mode === "full" ? "full" : "preview";
  if (!song_id) return j({ error: "Missing song_id" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: song } = await admin.from("songs")
    .select("user_id, audio_path, status, unlocked")
    .eq("id", song_id).single();

  if (!song || song.user_id !== user.id) return j({ error: "Not found" }, 404);
  if (!song.audio_path) return j({ error: "Not ready" }, 409);

  if (mode === "full" && !song.unlocked) {
    return j({ error: "Not unlocked", code: "locked" }, 403);
  }

  const ttl = mode === "full" ? 60 * 5 : 60 * 15; // 5 min HQ download, 15 min preview stream
  const { data, error } = await admin.storage.from("song-files")
    .createSignedUrl(song.audio_path, ttl);
  if (error) return j({ error: error.message }, 500);

  return j({ url: data.signedUrl, mode, unlocked: !!song.unlocked });
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...cors },
  });
}
