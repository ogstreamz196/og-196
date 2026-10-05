import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FREE_WINDOW_MS = 4 * 60 * 60 * 1000;

/** How the next image edit will be paid for: free slot or 1 coin. */
export const getImageEditStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("chat_image_allowance" as never)
      .select("last_free_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    const last = (data as { last_free_at: string | null } | null)?.last_free_at;
    const nextFreeAt = last ? new Date(last).getTime() + FREE_WINDOW_MS : 0;
    return { freeAvailable: nextFreeAt <= Date.now(), nextFreeAt, cost: 1 };
  });

export const editChatImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prompt: string; imageDataUrl?: string; imageUrl?: string }) => {
    const prompt = String(d?.prompt ?? "")
      .trim()
      .slice(0, 1000);
    if (!prompt) throw new Error("Tell OG Bot how to edit the image.");
    const imageUrl = typeof d.imageUrl === "string" ? d.imageUrl : "";
    if (imageUrl) {
      if (!/^https:\/\//.test(imageUrl) || imageUrl.length > 4000)
        throw new Error("That previous image can't be used — attach it again.");
      return { prompt, imageDataUrl: "", imageUrl };
    }
    if (typeof d.imageDataUrl !== "string" || !d.imageDataUrl.startsWith("data:image/"))
      throw new Error("Attach an image first.");
    if (d.imageDataUrl.length > 8_000_000) throw new Error("Image too large (max ~6MB).");
    return { prompt, imageDataUrl: d.imageDataUrl, imageUrl: "" };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { editImage, ImageEditError } = await import("@/lib/image-edit.server");

    // Conversation memory: re-use a previous edit from this chat. Only our own
    // storage URLs for this user's folder are accepted (no arbitrary fetches).
    let sourceDataUrl = data.imageDataUrl;
    if (data.imageUrl) {
      const base = process.env["SUPABASE_URL"] ?? "";
      const u = new URL(data.imageUrl);
      const okHost = base && u.origin === new URL(base).origin;
      const okPath = u.pathname.includes(`/chat-images/${context.userId}/`);
      if (!okHost || !okPath) throw new Error("That previous image can't be used — attach it again.");
      const res = await fetch(data.imageUrl);
      if (!res.ok) throw new Error("That previous image has expired — attach it again.");
      const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > 6_000_000) throw new Error("Image too large (max ~6MB).");
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000)
        bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      sourceDataUrl = `data:${mime};base64,${btoa(bin)}`;
    }

    const ref = `chat_image_edit:${crypto.randomUUID()}`;
    const supabase = supabaseAdmin;
    const charge = await supabase.rpc("consume_chat_image_edit", {
      p_user: context.userId,
      p_reference: ref,
    });
    if (charge.error) {
      if (/insufficient|balance|not enough/i.test(charge.error.message))
        return { ok: false as const, reason: "no_coins" as const };
      throw new Error("Couldn't start the edit. Try again.");
    }
    const c = charge.data as { free: boolean; cost: number; prev_free_at: string | null };

    try {
      const out = await editImage(data.prompt, sourceDataUrl);
      const path = `${context.userId}/${crypto.randomUUID()}.${out.mime.split("/")[1] || "png"}`;
      const bytes = Uint8Array.from(atob(out.b64), (ch) => ch.charCodeAt(0));
      const up = await supabaseAdmin.storage
        .from("chat-images")
        .upload(path, bytes, { contentType: out.mime });
      if (up.error) throw new Error(up.error.message);
      const signed = await supabaseAdmin.storage
        .from("chat-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed.error || !signed.data) throw new Error("sign failed");
      return { ok: true as const, url: signed.data.signedUrl, free: c.free, cost: c.cost };
    } catch (e) {
      await supabase.rpc("refund_chat_image_edit", {
        p_user: context.userId,
        p_free: c.free,
        p_prev: (c.prev_free_at ?? null) as string,
        p_reference: ref,
      });
      const s = e instanceof ImageEditError ? e.status : 500;
      if (s === 429 || s === 402)
        throw new Error(
          "OG Bot's image studio is taking a break — try again later. You weren't charged.",
        );
      if (s === 422 || s === 400)
        throw new Error("OG Bot couldn't make that edit. You weren't charged.");
      console.error("image edit failed", e);
      throw new Error("Image edit failed. You weren't charged.");
    }
  });
