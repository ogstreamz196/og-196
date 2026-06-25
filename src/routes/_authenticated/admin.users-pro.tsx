import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Users,
  Search,
  ShieldCheck,
  Loader2,
  MapPin,
  Smartphone,
  Coins,
  ExternalLink,
  X,
  Send,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BossNav } from "@/components/admin/BossNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  listUsersPro,
  getUserSignInHistory,
} from "@/lib/sign-in-tracking.functions";
import { getSheetsConfig } from "@/lib/sheets-sync.functions";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/users-pro")({
  component: UsersProPage,
});

type UserRow = Awaited<ReturnType<typeof listUsersPro>>[number];

function UsersProPage() {
  const role = useRole();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-pro", search],
    queryFn: () => listUsersPro({ data: { search } }),
    enabled: role.isAdmin || role.isBoss,
  });
  const { data: sheets } = useQuery({
    queryKey: ["sheets-config"],
    queryFn: () => getSheetsConfig(),
    enabled: role.isAdmin || role.isBoss,
  });

  if (role.isLoading) {
    return (
      <DashboardShell title="Users Pro">
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      </DashboardShell>
    );
  }
  if (!role.isAdmin && !role.isBoss) return <Navigate to="/" />;

  return (
    <DashboardShell title="Users Pro">
      <BossNav />
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-16 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Users className="h-6 w-6 text-primary" /> Users Pro
            </h1>
            <p className="text-sm text-muted-foreground">
              Merged Supabase + Google Sheets profile cards. Click a user to inspect device, geo & sign-in history.
            </p>
          </div>
          {sheets?.sheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheets.sheetId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Users Sheet
            </a>
          )}
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or display name…"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card/60 p-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Coins</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-left">Device</th>
                  <th className="px-4 py-3 text-left">Last sign-in</th>
                  <th className="px-4 py-3 text-left">Telegram</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className="cursor-pointer border-t border-border/40 transition hover:bg-primary/5"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold">{u.display_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Coins className="h-3.5 w-3.5 text-amber-400" />
                        {u.coin_balance ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.last_country ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-sky-400" />
                          {u.last_city ? `${u.last_city}, ` : ""}
                          {u.last_country}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.last_device ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.last_sign_in_at
                        ? formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true })
                        : "—"}
                      <div className="text-[10px] text-muted-foreground">
                        {u.sign_in_count ?? 0} total
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.telegram_chat_id ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          <ShieldCheck className="h-3 w-3" /> Linked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          Not linked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {(users ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No users match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <UserDrawer user={selected} onClose={() => setSelected(null)} sheetId={sheets?.sheetId} />}
    </DashboardShell>
  );
}

function UserDrawer({
  user,
  onClose,
  sheetId,
}: {
  user: UserRow;
  onClose: () => void;
  sheetId?: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["user-history", user.id],
    queryFn: () => getUserSignInHistory({ data: { userId: user.id, limit: 25 } }),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Profile card</div>
            <h2 className="text-xl font-bold">{user.display_name || user.email}</h2>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Coin balance" value={`${user.coin_balance ?? 0}`} />
          <Stat label="Sign-ins" value={`${user.sign_in_count ?? 0}`} />
          <Stat label="Country" value={user.last_country ?? "—"} />
          <Stat label="City" value={user.last_city ?? "—"} />
          <Stat label="Last IP" value={user.last_ip ?? "—"} mono />
          <Stat
            label="Last device"
            value={user.last_device ?? "—"}
          />
          <Stat
            label="Telegram"
            value={user.telegram_chat_id ? `chat ${user.telegram_chat_id}` : "Not linked"}
          />
          <Stat
            label="GPS consent"
            value={user.gps_consent ? "Granted" : "Not granted"}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/admin/users/$userId" params={{ userId: user.id }}>
            <Button size="sm" variant="outline">
              <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Admin actions
            </Button>
          </Link>
          {user.telegram_chat_id && (
            <Link to="/admin/users/$userId" params={{ userId: user.id }}>
              <Button size="sm" variant="outline">
                <Send className="mr-2 h-3.5 w-3.5" /> Send DM
              </Button>
            </Link>
          )}
          {sheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm" variant="outline">
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Sheets row
              </Button>
            </a>
          )}
        </div>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Known devices
        </h3>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <div className="space-y-2">
            {data?.devices.length === 0 && (
              <p className="text-xs text-muted-foreground">No devices recorded yet.</p>
            )}
            {data?.devices.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="h-3.5 w-3.5 text-sky-400" />
                  <span>
                    {d.browser} · {d.os} · {d.device_type}
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {d.sign_in_count}× · {d.last_country ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent sign-ins
        </h3>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <div className="space-y-1.5">
            {data?.events.length === 0 && (
              <p className="text-xs text-muted-foreground">No sign-in events yet.</p>
            )}
            {data?.events.map((e) => (
              <div
                key={e.id}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  e.is_signup
                    ? "border-emerald-400/40 bg-emerald-500/5"
                    : e.is_new_device || e.is_new_country
                      ? "border-amber-400/40 bg-amber-500/5"
                      : "border-border/40 bg-background/40",
                )}
              >
                <div className="flex justify-between">
                  <span className="font-mono">{e.ip ?? "—"}</span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {[e.city, e.country].filter(Boolean).join(", ") || "Unknown geo"} · {e.browser} · {e.os}
                  {e.is_signup && <span className="ml-1 text-emerald-300">· signup</span>}
                  {e.is_new_device && <span className="ml-1 text-amber-300">· new device</span>}
                  {e.is_new_country && <span className="ml-1 text-amber-300">· new country</span>}
                </div>
                {e.referrer && (
                  <div className="truncate text-[10px] text-muted-foreground/80">↗ {e.referrer}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold break-words", mono && "font-mono")}>{value}</div>
    </div>
  );
}
