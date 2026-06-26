import { useEffect } from "react";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Edge-swipe gesture: dragging from the very left edge of the screen
 * toward the right opens the mobile navigation sidebar.
 *
 * Activation rules (kept conservative to avoid hijacking horizontal
 * scroll inside lists, carousels, chat panes etc.):
 *   - Only on mobile (where the sidebar is an offcanvas Sheet).
 *   - Touch must START within EDGE_PX of the left edge.
 *   - Net horizontal movement must exceed THRESHOLD_PX.
 *   - Horizontal distance must clearly dominate vertical (≥ 1.5x).
 *   - Sidebar must currently be closed.
 */
export function SwipeToOpenSidebar() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    if (!isMobile || openMobile) return;

    const EDGE_PX = 24;
    const THRESHOLD_PX = 60;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX > EDGE_PX) {
        tracking = false;
        return;
      }
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx > THRESHOLD_PX && dx > dy * 1.5) {
        tracking = false;
        setOpenMobile(true);
      }
    };

    const onEnd = () => { tracking = false; };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [isMobile, openMobile, setOpenMobile]);

  return null;
}
