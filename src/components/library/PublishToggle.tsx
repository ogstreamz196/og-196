import { useState } from "react";
import { Globe, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

type Props = {
  songId: string;
  isPublic: boolean;
  onChanged?: () => void;
};

/**
 * Owner-only control: tracks stay private in the creator's library until they
 * explicitly publish them to the global player.
 */
export function PublishToggle({ songId, isPublic, onChanged }: Props) {
  const [value, setValue] = useState(isPublic);
  const [saving, setSaving] = useState(false);

  async function update(next: boolean) {
    setValue(next);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("songs")
        .update({ is_public: next } as never)
        .eq("id", songId);
      if (error) throw error;
      toast.success(
        next ? "Published to the global player" : "Removed from the global player",
      );
      onChanged?.();
    } catch (e) {
      setValue(!next);
      toast.error(e instanceof Error ? e.message : "Could not update sharing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label
      htmlFor={`publish-${songId}`}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-card"
    >
      <span className="flex min-w-0 items-start gap-3">
        <span aria-hidden className="mt-0.5 text-primary">
          {value ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          {value ? "Shared in the global player" : "Private to your library"}
          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
            {value
              ? "Anyone can listen. Switch off to keep it to yourself."
              : "Only you can hear this track. Switch on to share it with everyone."}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Switch
          id={`publish-${songId}`}
          checked={value}
          disabled={saving}
          onCheckedChange={update}
        />
      </span>
    </label>
  );
}
