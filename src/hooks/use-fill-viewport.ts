import { useEffect, useRef, useState } from "react";

/**
 * Measures the element's distance from the top of the viewport and returns the
 * exact remaining height, so a panel always fits the device browser page —
 * no page scroll, no floating window, whatever chrome sits above it.
 */
export function useFillViewport<T extends HTMLElement>(bottomGutter = 0) {
  const ref = useRef<T | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    function measure() {
      const el = ref.current;
      if (!el) return;
      const vv = window.visualViewport;
      const vh = vv?.height ?? window.innerHeight;
      // getBoundingClientRect() is in layout-viewport coordinates. On iOS the
      // visual viewport slides (keyboard, pinch-zoom, collapsing toolbars), so
      // shift the measurement by its offset or the panel overshoots the screen.
      const top = el.getBoundingClientRect().top - (vv?.offsetTop ?? 0);
      const nav = document.querySelector("nav.safe-bottom.fixed") as HTMLElement | null;
      // The mobile bottom nav is fixed — stop the panel at its top edge.
      const limit =
        nav && nav.offsetHeight > 0 ? nav.getBoundingClientRect().top - (vv?.offsetTop ?? 0) : vh;
      const availableHeight = Math.round(Math.min(limit, vh) - top - bottomGutter);
      const keyboardOpen = vv ? window.innerHeight - vv.height > 120 : false;
      // A tall minimum is useful during normal browsing, but it can make the
      // composer sit underneath a phone keyboard. While typing, honour the
      // smaller visual viewport instead of forcing the panel to overflow it.
      setHeight(Math.max(keyboardOpen ? 140 : 280, availableHeight));
    }
    measure();
    const raf = requestAnimationFrame(measure);
    // Chrome above the panel (boss bar, earn strip, bottom nav) can mount late.
    const timers = [60, 250, 800].map((ms) => window.setTimeout(measure, ms));
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    window.addEventListener("pageshow", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.removeEventListener("pageshow", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [bottomGutter]);

  return { ref, height };
}
