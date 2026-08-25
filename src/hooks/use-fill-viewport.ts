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
      const top = el.getBoundingClientRect().top;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const nav = document.querySelector("nav.safe-bottom.fixed") as HTMLElement | null;
      // The mobile bottom nav is fixed — stop the panel at its top edge.
      const limit = nav && nav.offsetParent !== null ? nav.getBoundingClientRect().top : vh;
      setHeight(Math.max(320, Math.round(Math.min(limit, vh) - top - bottomGutter)));


    }
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [bottomGutter]);

  return { ref, height };
}
