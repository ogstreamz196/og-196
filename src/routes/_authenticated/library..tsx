
function GeneratingStatus({ song }: { song: FullSong }) {
  const startedAt = useMemo(
    () => new Date(song.created_at).getTime(),
    [song.created_at],
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;
  const elapsedLabel = mm > 0 ? `${mm}m ${ss}s` : `${ss}s`;

  // Step inference from row state. Suno typically completes within ~60-90s.
  const hasCover = !!song.cover_url;
  const hasAudio = !!(song.audio_path || (song as any).sample_path);
  type StepState = "done" | "active" | "pending";
  const steps: { label: string; hint: string; state: StepState }[] = [
    {
      label: "Brief queued",
      hint: "Sent to the studio",
      state: "done",
    },
    {
      label: "Writing arrangement",
      hint: "Composing the track structure",
      state:
        song.status === "processing" || hasCover || hasAudio ? "done" : "active",
    },
    {
      label: "Generating audio",
      hint: "Suno is rendering vocals + instruments",
      state: hasAudio ? "done" : song.status === "processing" ? "active" : "pending",
    },
    {
      label: "Mastering & artwork",
      hint: "Cover art + final polish",
      state: hasAudio && hasCover ? "done" : hasAudio ? "active" : "pending",
    },
  ];

  // Soft progress estimate: 90% at 90s, then crawl up to 99%.
  const pct = Math.min(99, Math.round((elapsed / 90) * 90) + (hasAudio ? 5 : 0));
  const longRunning = elapsed > 120;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-background p-4 shadow-glow"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Generating your track…
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          Elapsed {elapsedLabel}
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-brand transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              aria-hidden
              className={
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold " +
                (s.state === "done"
                  ? "bg-primary text-primary-foreground"
                  : s.state === "active"
                    ? "bg-primary/20 text-primary ring-2 ring-primary"
                    : "bg-white/10 text-muted-foreground")
              }
            >
              {s.state === "done" ? "✓" : i + 1}
            </span>
            <span className="min-w-0">
              <span
                className={
                  s.state === "pending"
                    ? "text-muted-foreground"
                    : "font-semibold text-foreground"
                }
              >
                {s.label}
              </span>
              {s.state === "active" && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {s.hint}
                </span>
              )}
              {s.state === "pending" && (
                <span className="ml-2 text-xs text-muted-foreground">{s.hint}</span>
              )}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground">
        This usually takes 60–90 seconds. The page refreshes automatically the
        moment your song is ready — feel free to keep it open or come back later.
      </p>
      {longRunning && (
        <p className="text-xs text-amber-400">
          Taking a little longer than usual — sit tight, OG Bot is still cooking.
        </p>
      )}
    </div>
  );
}
