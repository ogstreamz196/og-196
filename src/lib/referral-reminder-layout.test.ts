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

  it("exposes a stable test id for layout regression scripts", () => {
    expect(src).toContain('data-testid="referral-reminder"');
  });
});
