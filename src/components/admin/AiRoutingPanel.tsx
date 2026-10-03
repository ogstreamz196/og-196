import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Zap, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "paid_first" | "free_first";
const KEY = ["ai-routing-mode"] as const;

const OPTIONS: { mode: Mode; title: string; desc: string; Icon: typeof Zap }[] = [
  {
    mode: "paid_first",
    title: "Paid Gemini first",
    desc: "Best quality. Every chat uses your paid key; free AIs only step in if Google is busy.",
    Icon: Zap,
  },
  {
    mode: "free_first",
    title: "Free AIs first (save money)",
    desc: "Chats use free AIs first. Paid key only used if they're busy, or for photos.",
    Icon: PiggyBank,
  },
];

/** Boss switch for the OG Bot chat AI order. Song lyrics are unaffected. */
export function AiRoutingPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Mode> => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ai_routing_mode")
        .maybeSingle();
      return data?.value === "free_first" ? "free_first" : "paid_first";
    },
  });
  const save = useMutation({
    mutationFn: async (mode: Mode) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "ai_routing_mode", value: mode as unknown as never }, { onConflict: "key" });
      if (error) throw new Error(error.message);
      return mode;
    },
    onSuccess: (mode) => {
      qc.setQueryData(KEY, mode);
      toast.success(mode === "free_first" ? "Free AIs now go first" : "Paid Gemini now goes first");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card/70 p-5">
      <h2 className="font-display text-lg font-black">AI cost control</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose which AI answers OG Bot chats first. Takes effect within 30 seconds.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ mode, title, desc, Icon }) => {
          const active = q.data === mode;
          return (
            <button
              key={mode}
              type="button"
              disabled={q.isLoading || save.isPending}
              onClick={() => !active && save.mutate(mode)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
              )}
            >
              <div className="flex items-center gap-2 font-bold">
                <Icon className="h-4 w-4 text-primary" />
                {title}
                {active && (
                  <span className="ml-auto text-xs font-black uppercase text-primary">On</span>
                )}
                {save.isPending && save.variables === mode && (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
