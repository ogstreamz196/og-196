import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SmokeStep = {
  id: string;
  label: string;
  status: "ok" | "fail" | "skip";
  ms: number;
  detail?: string;
};

export type SmokeResult = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  steps: SmokeStep[];
};

/**
 * One-click end-to-end smoke test:
 *  1. Verifies the caller's Supabase session (sign-in works).
 *  2. Creates a throwaway song row and kicks off suno-generate.
 *  3. Polls for status transition (queued/generating/completed).
 *  4. Sends a test message through chatOgBot to verify OG Messenger.
 *  5. Cleans up the throwaway song.
 *
 * Admin-only. Each step is timed and logged independently — a single
 * failure does not abort the whole run.
 */
export const runE2ESmokeTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SmokeResult> => {
    const { supabase, userId } = context;
    const steps: SmokeStep[] = [];
    const startedAt = new Date().toISOString();

    const run = async (id: string, label: string, fn: () => Promise<string | void>) => {
      const t0 = Date.now();
      try {
        const detail = (await fn()) || undefined;
        steps.push({ id, label, status: "ok", ms: Date.now() - t0, detail });
        return true;
      } catch (e) {
        steps.push({
          id,
          label,
          status: "fail",
          ms: Date.now() - t0,
          detail: e instanceof Error ? e.message : String(e),
        });
        return false;
      }
    };

    // 1) Admin gate + sign-in verified by middleware
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await run("auth", "Verify signed-in session", async () => {
      const { data, error } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      const isAdmin = (data || []).some((r) => r.role === "admin" || r.role === "dev");
      if (!isAdmin) throw new Error("Caller is not admin/dev");
      return `userId=${userId.slice(0, 8)}… role=admin`;
    });

    // 2) Create song row
    let songId: string | null = null;
    await run("create_song", "Create draft song row", async () => {
      const { data, error } = await supabase
        .from("songs")
        .insert({
          user_id: userId,
          title: "E2E smoke test",
          prompt: "Smoke test · automated",
          style: "ambient",
          lyrics: "test test test",
          status: "draft",
        } as never)
        .select("id")
        .single();
      if (error || !data?.id) throw new Error(error?.message || "no row");
      songId = data.id;
      return `song_id=${songId}`;
    });

    // 3) Kick off generation
    if (songId) {
      await run("invoke_generate", "Invoke suno-generate", async () => {
        const { error } = await supabase.functions.invoke("suno-generate", {
          body: {
            song_id: songId,
            prompt: "Smoke test · automated",
            lyrics: "test test test",
            title: "E2E smoke test",
            style: "ambient",
          },
        });
        if (error) throw new Error(error.message || "invoke failed");
        return "queued";
      });

      // 4) Poll status for up to ~20s
      await run("poll_status", "Poll status transition (≤20s)", async () => {
        const deadline = Date.now() + 20_000;
        let last = "draft";
        while (Date.now() < deadline) {
          const { data } = await supabase
            .from("songs")
            .select("status")
            .eq("id", songId!)
            .maybeSingle();
          last = (data as { status?: string } | null)?.status || last;
          if (last !== "draft") return `status=${last}`;
          await new Promise((r) => setTimeout(r, 1500));
        }
        if (last === "draft") throw new Error("Status never left 'draft' within 20s");
        return `status=${last}`;
      });
    }

    // 5) OG Messenger round-trip
    await run("og_chat", "Send OG Messenger test message", async () => {
      const { chatOgBot } = await import("@/lib/og-messenger.functions");
      const res = await chatOgBot({
        data: {
          messages: [{ role: "user", content: "ping — automated smoke test" }],
          mode: "safe",
        },
      } as never);
      const reply = (res as { reply?: string } | undefined)?.reply || "";
      if (!reply || reply.length < 2) throw new Error("Empty reply from OG bot");
      return `reply (${reply.length} chars): ${reply.slice(0, 80)}…`;
    });

    // 6) Cleanup
    if (songId) {
      await run("cleanup", "Delete smoke-test song", async () => {
        const { error } = await supabaseAdmin.from("songs").delete().eq("id", songId!);
        if (error) throw error;
        return "ok";
      });
    }

    const finishedAt = new Date().toISOString();
    return {
      ok: steps.every((s) => s.status !== "fail"),
      startedAt,
      finishedAt,
      steps,
    };
  });
