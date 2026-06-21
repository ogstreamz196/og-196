// Hook that owns the hidden Suno alt-take state for a song workspace:
//   - loads sibling variation rows for the same Suno task
//   - exposes reveal / basket / checkout actions
//   - mirrors the server-side pricing formula in supabase/functions/reveal-variation
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/use-settings";
import { invokeError } from "@/lib/invoke-error";
import type { Variation } from "@/components/library/song-workspace/types";

interface UseVariationsArgs {
  songId: string;
  songStatus: string | null | undefined;
  balance: number;
  previewCost: number;
  onChanged?: () => void;
}

export function useVariations({ songId, songStatus, balance, previewCost, onChanged }: UseVariationsArgs) {
  const { data: settings } = useSettings();
  const [variations, setVariations] = useState<Variation[]>([]);
  const [basket, setBasket] = useState<Set<string>>(() => new Set());
  const [busyVariation, setBusyVariation] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const variationDivisor = Math.max(1, settings?.coins_per_variation_divisor ?? 2);
  const variationCost = useMemo(
    () => Math.max(1, Math.ceil(previewCost / variationDivisor)),
    [previewCost, variationDivisor],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: self } = await supabase
        .from("songs").select("suno_task_id").eq("id", songId).maybeSingle();
      const task = (self as { suno_task_id?: string | null })?.suno_task_id;
      if (!task) { if (!cancelled) setVariations([]); return; }
      const { data: sibs } = await supabase
        .from("songs")
        .select("id, title, cover_url, revealed")
        .eq("suno_task_id", task)
        .eq("is_variation", true)
        .neq("id", songId);
      if (!cancelled) setVariations((sibs ?? []) as Variation[]);
    })();
    return () => { cancelled = true; };
  }, [songId, songStatus]);

  const revealOne = useCallback(async (id: string) => {
    setBusyVariation(id);
    try {
      const { data, error } = await supabase.functions.invoke("reveal-variation", { body: { song_id: id } });
      if (error) throw new Error(invokeError(error, "Reveal failed"));
      if (!data?.already) toast.success(`Alt take revealed · -${data?.cost ?? variationCost} coins`);
      setVariations((vs) => vs.map((v) => v.id === id ? { ...v, revealed: true } : v));
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reveal failed");
      throw e;
    } finally {
      setBusyVariation(null);
    }
  }, [onChanged, variationCost]);

  const toggleBasket = useCallback((id: string) => {
    setBasket((b) => {
      const next = new Set(b);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearBasket = useCallback(() => setBasket(new Set()), []);

  const checkoutBasket = useCallback(async () => {
    const ids = Array.from(basket);
    const total = ids.length * variationCost;
    if (ids.length === 0) return;
    if (balance < total) { toast.error(`Need ${total} coins — current balance ${balance}`); return; }
    setCheckingOut(true);
    try {
      for (const id of ids) {
        // Sequential so deduct_coins sees a consistent running balance.
        await revealOne(id).catch(() => { throw new Error(`Stopped at ${id.slice(0, 6)}`); });
      }
      setBasket(new Set());
      toast.success(`Basket checked out · -${total} coins`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout interrupted");
    } finally {
      setCheckingOut(false);
    }
  }, [balance, basket, revealOne, variationCost]);

  return {
    variations,
    basket,
    busyVariation,
    checkingOut,
    variationCost,
    revealOne,
    toggleBasket,
    clearBasket,
    checkoutBasket,
  };
}
