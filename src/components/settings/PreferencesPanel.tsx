import { Sparkles, MessageSquareMore, Music2, Palette, Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";
import { useOgMode } from "@/hooks/use-og-mode";
import { useAppPreferences } from "@/hooks/use-app-preferences";

/**
 * Drop-in preferences card group for /settings.
 * Stores assistant tone in DB (foul_mouth) and the rest per-browser.
 */
export function PreferencesPanel() {
  const { foulMouth, isLoading } = useFoulMouth();
  const setFoulMouth = useSetFoulMouth();
  const { mode, setMode } = useOgMode();
  const { prefs, update } = useAppPreferences();

  return (
    <div className="space-y-6">
      {/* Assistant */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-4 w-4 text-primary" /> Assistant preferences
          </CardTitle>
          <CardDescription>
            Defaults for OG Messenger and the floating assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Default mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "og" | "safe")}
              className="grid grid-cols-2 gap-2"
            >
              <ModeOption value="og" title="OG" body="British banter, full personality." />
              <ModeOption value="safe" title="Safe" body="Family-friendly, no swearing." />
            </RadioGroup>
          </div>

          <ToggleRow
            icon={<MessageSquareMore className="h-4 w-4" />}
            label="Foul-mouth"
            description="When OG mode is on, allow stronger language."
            checked={foulMouth}
            disabled={isLoading || setFoulMouth.isPending}
            onChange={(v) => setFoulMouth.mutate(v)}
          />
        </CardContent>
      </Card>

      {/* Music creation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Music2 className="h-4 w-4 text-primary" /> Music creation defaults
          </CardTitle>
          <CardDescription>Pre-fill new song briefs with your usual taste.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            id="pref-mood"
            label="Default mood"
            value={prefs.defaultMood}
            onChange={(v) => update("defaultMood", v)}
            placeholder="Warm, hopeful…"
          />
          <Field
            id="pref-genre"
            label="Default genre"
            value={prefs.defaultGenre}
            onChange={(v) => update("defaultGenre", v)}
            placeholder="Acoustic folk"
          />
          <Field
            id="pref-lyrical"
            label="Lyrical style"
            value={prefs.defaultLyricalStyle}
            onChange={(v) => update("defaultLyricalStyle", v)}
            placeholder="Story-driven"
          />
        </CardContent>
      </Card>

      {/* Appearance + notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-4 w-4 text-primary" /> Appearance & notifications
          </CardTitle>
          <CardDescription>Visual theme and what we ping you about.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Theme</Label>
            <RadioGroup
              value={prefs.theme}
              onValueChange={(v) => update("theme", v as "system" | "light" | "dark")}
              className="grid grid-cols-3 gap-2"
            >
              <ModeOption value="system" title="System" body="Match device." />
              <ModeOption value="light" title="Light" body="Bright surfaces." />
              <ModeOption value="dark" title="Dark" body="Low-light." />
            </RadioGroup>
          </div>

          <Separator />

          <ToggleRow
            icon={<Bell className="h-4 w-4" />}
            label="Notify when a song is ready"
            description="In-app toast when generation completes."
            checked={prefs.notifySongReady}
            onChange={(v) => update("notifySongReady", v)}
          />
          <ToggleRow
            icon={<MessageSquareMore className="h-4 w-4" />}
            label="Notify on new Messenger replies"
            description="Surface a toast when OG replies in the background."
            checked={prefs.notifyMessenger}
            onChange={(v) => update("notifyMessenger", v)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ModeOption({ value, title, body }: { value: string; title: string; body: string }) {
  return (
    <label
      htmlFor={`opt-${value}`}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/40 p-3 transition-colors hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
    >
      <RadioGroupItem id={`opt-${value}`} value={value} className="mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-none">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
    </label>
  );
}

function ToggleRow({
  icon, label, description, checked, disabled, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-none">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function Field({
  id, label, value, onChange, placeholder,
}: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
