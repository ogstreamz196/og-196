/**
 * Boss-only controls for the TikTok render queue.
 *
 * The heavy lifting (muxing the track over the background clip) happens in
 * `scripts/tiktok-batch.mjs`, which needs ffmpeg and therefore cannot run in
 * the edge runtime. These functions own the queue itself: they work out which
 * paid-unlocked tracks still need a video and mark them as pending so the
 * batch renderer picks them up.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = {
  supabase: {
    rpc: (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  userId: string;
};

async function assertBoss(ctx: Ctx) {
  const admin = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  const boss = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "boss" });
  if (admin.error || boss.error) throw new Error("Request failed");
  if (!admin.data && !boss.data) throw new Error("Forbidden");
}

export type TikTokRenderStatus = {
  done: number;
  pending: number;
  failed: number;
  queued: number;
  recent: { song_id: string; title: string | null; status: string; drive_url: string | null }[];
};

async function computeStatus(): Promise<TikTokRenderStatus> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: unlocked }, { data: renders }] = await Promise.all([
    supabaseAdmin.from("unlocked_songs").select("song_id").limit(2000),
    supabaseAdmin
      .from("tiktok_renders")
      .select("song_id,status,drive_url,updated_at")
      .order("updated_at", { ascending: false }),
  ]);

  const rows = renders ?? [];
  const byId = new Map(rows.map((r) => [r.song_id, r]));
  const unlockedIds = [...new Set((unlocked ?? []).map((u) => u.song_id))];
  const queued = unlockedIds.filter((id) => byId.get(id)?.status !== "done").length;

  const recentIds = rows.slice(0, 8).map((r) => r.song_id);
  const { data: songs } = recentIds.length
    ? await supabaseAdmin.from("songs").select("id,title").in("id", recentIds)
    : { data: [] as { id: string; title: string | null }[] };
  const titles = new Map((songs ?? []).map((s) => [s.id, s.title]));

  return {
    done: rows.filter((r) => r.status === "done").length,
    pending: rows.filter((r) => r.status === "pending").length,
    failed: rows.filter((r) => r.status === "failed").length,
    queued,
    recent: rows.slice(0, 8).map((r) => ({
      song_id: r.song_id,
      title: titles.get(r.song_id) ?? null,
      status: r.status,
      drive_url: r.drive_url,
    })),
  };
}

export const getTikTokRenderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBoss(context as unknown as Ctx);
    return computeStatus();
  });

/** Mark every paid-unlocked track without a finished video as pending. */
export const queueTikTokBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBoss(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: unlocked }, { data: renders }] = await Promise.all([
      supabaseAdmin.from("unlocked_songs").select("song_id").limit(2000),
      supabaseAdmin.from("tiktok_renders").select("song_id,status"),
    ]);
    const done = new Set((renders ?? []).filter((r) => r.status === "done").map((r) => r.song_id));
    const ids = [...new Set((unlocked ?? []).map((u) => u.song_id))].filter((id) => !done.has(id));

    if (ids.length) {
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin.from("tiktok_renders").upsert(
        ids.map((song_id) => ({ song_id, status: "pending", error: null, updated_at: now })),
        { onConflict: "song_id" },
      );
      if (error) throw new Error("Could not queue renders");
    }

    return { queued: ids.length, status: await computeStatus() };
  });
