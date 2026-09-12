import { Sparkles, MessageSquareMore, Music2, Palette, Bell, Type, Rows3, Minus, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFoulMouth, useSetFoulMouth } from "@/hooks/use-foul-mouth";
import { useRole } from "@/hooks/use-role";
import { useAppPreferences, type AppPreferences } from "@/hooks/use-app-preferences";
import { useDisplayPrefs, useSetDisplayPrefs, clampScale, type Density } from "@/hooks/use-display-prefs";
import { useAura, type AuraLevel } from "@/hooks/use-aura";

/**
 * Drop-in preferences card group for /settings.
 * Stores assistant tone in DB (foul_mouth) and the rest per-browser.
 */
export function PreferencesPanel() {
  const { foulMouth, isLoading } = useFoulMouth();
  const setFoulMouth = useSetFoulMouth();
  const { isVip } = useRole();
  
  const { prefs, update: rawUpdate } = useAppPreferences();
  const update = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    rawUpdate(key, value);
    toast.success("Settings saved", { id: "settings-saved" });
  };
  const display = useDisplayPrefs();
  const setDisplay = useSetDisplayPrefs();
  const aura = useAura();

  const SCALE_STEP = 0.05;
  const scalePct = Math.round(display.textScale * 100);
  const bumpScale = (delta: number) =>
    setDisplay.mutate({ textScale: clampScale(display.textScale + delta) });

  return (
    <div className="space-y-6">
      {/* Display — saved to your account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Type className="h-4 w-4 text-primary" /> Display
          </CardTitle>
          <CardDescription>
            Text size and spacing — saved to your account and used on every device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="text-scale">Text size</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{scalePct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Decrease text size"
                disabled={display.textScale <= 0.85 || setDisplay.isPending}
                onClick={() => bumpScale(-SCALE_STEP)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <input
                id="text-scale"
                type="range"
                min={85}
                max={150}
                step={5}
                value={scalePct}
                onChange={(e) => setDisplay.mutate({ textScale: Number(e.target.value) / 100 })}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Increase text size"
                disabled={display.textScale >= 1.5 || setDisplay.isPending}
                onClick={() => bumpScale(SCALE_STEP)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Reset to default"
                disabled={display.textScale === 1 || setDisplay.isPending}
                onClick={() => setDisplay.mutate({ textScale: 1 })}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Rows3 className="h-4 w-4" /> Layout density</Label>
            <RadioGroup
              value={display.density}
              onValueChange={(v) => setDisplay.mutate({ density: v as Density })}
              className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3"
            >
              <ModeOption value="compact" title="Compact" body="Tighter rows." />
              <ModeOption value="comfortable" title="Comfortable" body="Default rhythm." />
              <ModeOption value="spacious" title="Spacious" body="More breathing room." />
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Red aura intensity</Label>
            <RadioGroup
              value={aura.level}
              onValueChange={(v) => aura.setLevel(v as AuraLevel)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              <ModeOption value="off" title="Off" body="No glow." />
              <ModeOption value="low" title="Low" body="Faint hint." />
              <ModeOption value="medium" title="Medium" body="Default." />
              <ModeOption value="high" title="High" body="Bold." />
            </RadioGroup>
          </div>
        </CardContent>
      </Card>


      {/* Assistant */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-4 w-4 text-primary" /> Assistant preferences
          </CardTitle>
          <CardDescription>
            Defaults for OG Bot and the floating assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ToggleRow
            icon={<MessageSquareMore className="h-4 w-4" />}
            label={isVip ? "Foul-mouth" : "Foul-mouth (VIP only)"}
            description={
              isVip
                ? "Let OG use stronger language in replies."
                : "Unlock with OG VIP (£5/month) to let OG go fully savage."
            }
            checked={isVip && foulMouth}
            disabled={!isVip || isLoading || setFoulMouth.isPending}
            onChange={(v) => setFoulMouth.mutate(v)}
          />
          {!isVip && (
            <Link
              to="/buy-coins"
              search={{ flow: "vip" } as never}
              className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade to OG VIP — £5/month
            </Link>
          )}
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
              className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3"
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
