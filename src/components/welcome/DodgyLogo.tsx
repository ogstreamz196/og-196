import { useEffect, useRef, useState } from "react";
import ogBotAsset from "@/assets/ogbot.png.asset.json";

type Props = {
  /** Pixel size of the logo. */
  size?: number;
  /** Maximum px the logo can drift from its anchor. */
  maxDrift?: number;
  /** Cursor radius (px) that triggers dodging. */
  dodgeRadius?: number;
  className?: string;
};

/**
 * OG Bot logo that dodges the mouse cursor on desktop. On touch / coarse-pointer
 * devices it falls back to a tiny gentle bob to keep the page cheap to render.
 */
export function DodgyLogo({
  size = 96,
  maxDrift = 90,
  dodgeRadius = 160,
  className = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const [isFine, setIsFine] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: fine) and (hover: hover)");
    const update = () => setIsFine(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    // Mobile / touch: skip listeners entirely, rely on CSS bob.
    if (!isFine) {
      el.style.transform = "translate3d(0,0,0)";
      return;
    }

    const tick = () => {
      posRef.current.x += (targetRef.current.x - posRef.current.x) * 0.18;
      posRef.current.y += (targetRef.current.y - posRef.current.y) * 0.18;
      el.style.transform = `translate3d(${posRef.current.x.toFixed(1)}px, ${posRef.current.y.toFixed(1)}px, 0)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - e.clientX;
      const dy = cy - e.clientY;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < dodgeRadius) {
        const strength = (dodgeRadius - dist) / dodgeRadius; // 0..1
        const push = maxDrift * strength;
        targetRef.current = {
          x: Math.max(-maxDrift, Math.min(maxDrift, (dx / dist) * push + posRef.current.x * 0.6)),
          y: Math.max(-maxDrift, Math.min(maxDrift, (dy / dist) * push + posRef.current.y * 0.6)),
        };
      } else {
        // ease back home
        targetRef.current = { x: 0, y: 0 };
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isFine, maxDrift, dodgeRadius]);

  return (
    <div
      className={`pointer-events-none inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        ref={wrapRef}
        className={isFine ? "will-change-transform" : "animate-[wcBob_4s_ease-in-out_infinite]"}
        style={{ width: size, height: size, transition: isFine ? undefined : "transform 0.3s" }}
      >
        <img
          src={ogBotAsset.url}
          alt="OG Bot"
          width={512}
          height={512}
          decoding="async"
          draggable={false}
          className="h-full w-full select-none rounded-2xl object-contain shadow-glow"
        />
      </div>
      <style>{`@keyframes wcBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }`}</style>
    </div>
  );
}
