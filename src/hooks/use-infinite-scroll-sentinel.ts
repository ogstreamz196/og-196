import { useEffect, type RefObject } from "react";

/**
 * Observes a sentinel element and invokes `onHit` when it enters the viewport
 * (with a 400px root margin so loads kick off before the user reaches the edge).
 *
 * Pass `enabled = false` to disable observation entirely (e.g. when there is
 * no next page or a fetch is already in flight).
 */
export function useInfiniteScrollSentinel(
  ref: RefObject<Element | null>,
  options: {
    enabled: boolean;
    onHit: () => void;
    rootMargin?: string;
    /** Re-create the observer whenever any of these values change. */
    deps?: ReadonlyArray<unknown>;
  },
) {
  const { enabled, onHit, rootMargin = "400px", deps = [] } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onHit();
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rootMargin, ...deps]);
}
