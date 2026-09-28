import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/self-delete-account.functions";

export function DeleteMyAccount() {
  const del = useServerFn(deleteMyAccount);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await del({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut();
      toast.success("Your account and data have been deleted.");
      window.location.href = "/welcome";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete account");
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-card p-4 shadow-card sm:p-6">
      <div>
        <h2 className="font-semibold text-destructive">Delete account</h2>
        <p className="text-xs text-muted-foreground">
          Permanently deletes your account, songs, coins and linked data. Purchases are not refundable after deletion. This cannot be undone.
        </p>
      </div>
      {!open ? (
        <Button variant="destructive" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete my account
        </Button>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Type DELETE to confirm" placeholder="Type DELETE" value={text} onChange={(e) => setText(e.target.value)} />
          <Button variant="destructive" disabled={text !== "DELETE" || busy} onClick={run}>
            {busy ? "Deleting…" : "Confirm delete"}
          </Button>
          <Button variant="outline" onClick={() => { setOpen(false); setText(""); }}>Cancel</Button>
        </div>
      )}
    </section>
  );
}
