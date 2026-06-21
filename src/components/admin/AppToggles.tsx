import { useEffect, useState } from "react";
import { Music2, Bot } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface ToggleDef {
  key: string;
  label: string;
  desc: string;
}

const MUSIC_HUB_TOGGLES: ToggleDef[] = [
  { key: "mh_autoplay", label: "Autoplay new tracks", desc: "Start playing songs as soon as they finish generating." },
  { key: "mh_show_lyrics", label: "Show lyrics by default", desc: "Open the lyrics panel automatically on every song." },
  { key: "mh_allow_downloads", label: "Allow downloads", desc: "Show the download button on completed tracks." },
  { key: "mh_public_library", label: "Public library", desc: "Make your finished tracks discoverable in the public hub." },
  { key: "mh_explicit_filter", label: "Filter explicit prompts", desc: "Block prompts containing flagged language before generation." },
];

const OG_BOT_TOGGLES: ToggleDef[] = [
  { key: "ob_widget_enabled", label: "Floating widget", desc: "Show the OG Bot bubble on every page." },
  { key: "ob_messenger_enabled", label: "OG Messenger", desc: "Enable the full-page chat experience." },
  { key: "ob_proactive_greetings", label: "Proactive greetings", desc: "Let OG Bot start the conversation when a visitor lands." },
  { key: "ob_voice_replies", label: "Voice replies", desc: "Read replies aloud using OG Bot's voice." },
  { key: "ob_foul_mouth", label: "Foul-mouth mode", desc: "Allow OG Bot to use unfiltered slang and adult language." },
];

export function AppToggles() {
  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <SettingsGroup
        icon={<Music2 className="h-5 w-5 text-primary" />}
        title="Music Hub"
        subtitle="Control how Music Hub generates and displays tracks."
        toggles={MUSIC_HUB_TOGGLES}
        storageKey="dev.music_hub"
      />
      <SettingsGroup
        icon={<Bot className="h-5 w-5 text-primary" />}
        title="OG Bot"
        subtitle="Tune the embedded OG Bot assistant."
        toggles={OG_BOT_TOGGLES}
        storageKey="dev.og_bot"
      />
    </div>
  );
}

function SettingsGroup({
  icon, title, subtitle, toggles, storageKey,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  toggles: ToggleDef[];
  storageKey: string;
}) {
  const [state, setState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setState(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [storageKey]);

  function update(k: string, v: boolean, label: string) {
    setState((prev) => {
      const next = { ...prev, [k]: v };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    toast.success(`${label} ${v ? "enabled" : "disabled"}`);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15">{icon}</div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {toggles.map((t) => (
          <div key={t.key} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">{t.label}</p>
              <p className="text-sm text-muted-foreground">{t.desc}</p>
            </div>
            <Switch
              checked={!!state[t.key]}
              onCheckedChange={(v) => update(t.key, v, t.label)}
              aria-label={t.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
