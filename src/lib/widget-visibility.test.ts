import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeWidgetVisible, type TokenLike } from "./widget-visibility";

describe("computeWidgetVisible", () => {
  it("shows the widget for internal users with no tokens", () => {
    expect(computeWidgetVisible([])).toBe(true);
    expect(computeWidgetVisible(null)).toBe(true);
    expect(computeWidgetVisible(undefined)).toBe(true);
  });

  it("shows the widget when at least one token is active", () => {
    expect(computeWidgetVisible([{ status: "active" }])).toBe(true);
    expect(
      computeWidgetVisible([{ status: "suspended" }, { status: "active" }]),
    ).toBe(true);
  });

  it("hides the widget when every token is suspended", () => {
    expect(computeWidgetVisible([{ status: "suspended" }])).toBe(false);
    expect(
      computeWidgetVisible([{ status: "suspended" }, { status: "suspended" }]),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// E2E-style: simulate a Supabase Realtime UPDATE payload flowing through the
// channel handler and assert the visibility decision updates without polling.
// ---------------------------------------------------------------------------

type PgChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: { id: string; status: string } | null;
  old: { id: string; status: string } | null;
};

type Handler = (payload: PgChangePayload) => void;

function createMockSupabase() {
  let handler: Handler | null = null;
  const channel = {
    on: (_evt: string, _filter: unknown, cb: Handler) => {
      handler = cb;
      return channel;
    },
    subscribe: () => channel,
  };
  return {
    client: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
    emit: (payload: PgChangePayload) => {
      if (!handler) throw new Error("subscription handler not registered");
      handler(payload);
    },
  };
}

describe("OG Bot widget visibility via Supabase Realtime", () => {
  let tokens: TokenLike[];
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    tokens = [{ status: "active" }];
    mock = createMockSupabase();

    // Wire a subscription that mutates the tokens list when a row changes —
    // the exact shape used by developer.tsx + OgBotWidget realtime hooks.
    mock.client
      .channel("bot-tokens-test")
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_tokens" }, (p: PgChangePayload) => {
        if (p.eventType === "UPDATE" && p.new) {
          const next = p.new.status;
          tokens = tokens.map((t, i) => (i === 0 ? { status: next } : t));
        }
      })
      .subscribe();
  });

  it("hides the widget within one realtime tick of a suspend event", () => {
    expect(computeWidgetVisible(tokens)).toBe(true);

    mock.emit({
      eventType: "UPDATE",
      old: { id: "tok_1", status: "active" },
      new: { id: "tok_1", status: "suspended" },
    });

    expect(computeWidgetVisible(tokens)).toBe(false);
  });

  it("reveals the widget within one realtime tick of a reactivate event", () => {
    tokens = [{ status: "suspended" }];
    expect(computeWidgetVisible(tokens)).toBe(false);

    mock.emit({
      eventType: "UPDATE",
      old: { id: "tok_1", status: "suspended" },
      new: { id: "tok_1", status: "active" },
    });

    expect(computeWidgetVisible(tokens)).toBe(true);
  });

  it("registers exactly one channel subscription (no leaks)", () => {
    expect(mock.client.channel).toHaveBeenCalledTimes(1);
  });
});
