import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Locks the responsive contract for the ReferralReminder "attachment"
 * panel so a refactor can't silently break consistent scaling.
 */
const src = readFileSync(
  resolve(__dirname, "../components/referrals/ReferralReminder.tsx"),
  "utf8",
);

describe("ReferralReminder responsive contract", () => {
  it("uses clamp-based padding for consistent spacing across breakpoints", () => {
    expect(src).toMatch(/\[padding:clamp\(/);
  });

  it("uses clamp-based body font-size so typography scales smoothly", () => {
    expect(src).toMatch(/clamp\(0\.8125rem,\s*2\.6vw,\s*0\.9375rem\)/);
  });

  it("uses a shrinkable grid column on mobile (min-w-0) so text never clips", () => {
    expect(src).toMatch(/grid-cols-\[minmax\(0,1fr\)_auto\]/);
    expect(src).toMatch(/min-w-0/);
  });

  it("gives action buttons 44px tap targets on mobile", () => {
    // h-11 = 44px (Tailwind), reduced to h-9 at sm+
    expect(src).toMatch(/h-11[^"]*sm:h-9/);
  });

  it("gives the inline Copy link button a 44x44 mobile tap target", () => {
    expect(src).toMatch(/min-h-11 min-w-11[^"]*sm:min-h-9/);
  });

  it("uses high-contrast foreground tokens (not muted) for inline controls", () => {
    // muted-foreground on bg-coin/5 fails AA at 11px; we use foreground/85+
    expect(src).not.toMatch(/text-muted-foreground/);
    expect(src).toMatch(/text-foreground\/85/);
  });

  it("labels icon-bearing controls for screen readers", () => {
    expect(src).toMatch(/aria-label=\{copied \? "Referral link copied"/);
    expect(src).toMatch(/aria-label="Share your referral link"/);
    expect(src).toMatch(/aria-label="See referral earnings details"/);
  });

  it("renders a visible focus ring on every interactive control", () => {
    const focusRings = src.match(/focus-visible:ring-2/g) ?? [];
    expect(focusRings.length).toBeGreaterThanOrEqual(3);
  });

  it("exposes a stable test id for layout regression scripts", () => {
    expect(src).toContain('data-testid="referral-reminder"');
  });
});
