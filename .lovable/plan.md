## Goal

On mobile, the "Bespoke tracks" and "Made for you" labels in the welcome hero badge are small and centered under/above the logo. Make them much bigger so they span the badge edge-to-edge across the mobile screen, without changing tablet/desktop sizing.

## Change

Single edit in `src/routes/welcome.tsx` (the badge at line ~436–440).

Update the two `<span>` labels:
- Bump base (mobile) font size from `text-sm` (inherited) to roughly `text-3xl` / `text-4xl` with tighter letter-spacing so each label fills its row.
- Switch the badge container so the two labels stretch to the badge's full width on mobile (`w-full` + `text-center`), then revert to compact sizing at `sm:` and up.
- Keep current tablet (`sm:text-xl`) and desktop (`md:text-3xl`) sizing untouched.

Mobile result: badge stacked column = big "BESPOKE TRACKS" row → full-width logo → big "MADE FOR YOU" row, all spanning the badge edge-to-edge.

## Out of scope

- No changes to logo size, badge border/background, or any other section.
- No tablet/desktop visual changes.
