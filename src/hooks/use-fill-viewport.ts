import { useEffect, useRef, useState } from "react";

/**
 * Measures the element's distance from the top of the viewport and returns the
 * exact remaining height, so a panel always fits the device browser page —
 * no page scroll, no floating window, whatever chrome sits above it.
 *
 * Mobile keyboards fire 20–30 visualViewport events during their slide-in
 * animation. Re-rendering on each one fights the keyboard and makes taps feel
 * lost, so measurements are coalesced into a single animation frame and only
 * committed when the height actually moves by a meaningful amount.
 */
export function useFillViewport<T extends HTMLElement>(bottomGutter = 0) {
  const ref = useRef<T | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    let last = -1;

    function compute() {
      const el = ref.current;
      if (!el) return;
      const vv = window.visualViewport;
      const vh = vv?.height ?? window.innerHeight;
      // getBoundingClientRect() is in layout-viewport coordinates. On iOS the
      // visual viewport slides (keyboard, pinch-zoom, collapsing toolbars), so
      // shift the measurement by its offset or the panel overshoots the screen.
      const top = el.getBoundingClientRect().top - (vv?.offsetTop ?? 0);
      const nav = document.querySelector("nav.safe-bottom.fixed") as HTMLElement | null;
      const keyboardOpen =
        document.documentElement.dataset["kb"] === "1" ||
        (vv ? window.innerHeight - vv.height > 120 : false);
      // The mobile bottom nav is fixed — stop the panel at its top edge. While
      // the keyboard is up the nav is pushed off-screen, so ignore it then.
      const limit =
        !keyboardOpen && nav && nav.offsetHeight > 0
          ? nav.getBoundingClientRect().top - (vv?.offsetTop ?? 0)
          : vh;
      const availableHeight = Math.round(Math.min(limit, vh) - top - bottomGutter);
      // A tall minimum is useful during normal browsing, but it can make the
      // composer sit underneath a phone keyboard. While typing, honour the
      // smaller visual viewport instead of forcing the panel to overflow it.
      const next = Math.max(keyboardOpen ? 140 : 280, availableHeight);
      // Ignore sub-pixel jitter from the keyboard animation; only commit real
      // changes so React isn't re-rendering the whole chat on every frame.
      if (last >= 0 && Math.abs(next - last) < 8) return;
      last = next;
      setHeight(next);
    }

    function measure() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        compute();
      });
    }

    // Keyboard slide-in: measure on the next frame (coalesced) and once more
    // after the animation settles, so the composer never hides behind it.
    let settle = 0;
    function measureSettled() {
      measure();
      window.clearTimeout(settle);
      settle = window.setTimeout(measure, 200);
    }

    compute();
    // Chrome above the panel (boss bar, earn strip, bottom nav) can mount late.
    const timers = [60, 250, 800].map((ms) => window.setTimeout(measure, ms));
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("resize", measureSettled);
    window.addEventListener("orientationchange", measure);
    window.addEventListener("pageshow", measure);
    window.addEventListener("og:kb", measureSettled);
    window.visualViewport?.addEventListener("resize", measureSettled);
    window.visualViewport?.addEventListener("scroll", measureSettled);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", measureSettled);
      window.removeEventListener("orientationchange", measure);
      window.removeEventListener("pageshow", measure);
      window.removeEventListener("og:kb", measureSettled);
      window.visualViewport?.removeEventListener("resize", measureSettled);
      window.visualViewport?.removeEventListener("scroll", measureSettled);
    };
  }, [bottomGutter]);

  return { ref, height };
}
