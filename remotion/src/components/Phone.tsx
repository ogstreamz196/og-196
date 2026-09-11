import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { C } from "../theme";

type Props = {
  src: string;
  /** delay in frames before the phone flies in */
  delay?: number;
  width?: number;
  rotate?: number;
  x?: number;
  y?: number;
  /** how far the screenshot pans vertically over the scene (px) */
  pan?: number;
};

/** A phone-shaped frame holding a real screenshot from the app. */
export const Phone: React.FC<Props> = ({
  src,
  delay = 0,
  width = 520,
  rotate = -5,
  x = 0,
  y = 0,
  pan = -120,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 120 } });
  const rise = interpolate(enter, [0, 1], [180, 0]);
  const height = width * 2.1;
  const panY = interpolate(frame - delay, [0, 170], [0, pan], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const float = Math.sin((frame - delay) / 40) * 10;

  return (
    <div
      style={{
        width,
        height,
        transform: `translate(${x}px, ${y + rise + float}px) rotate(${rotate}deg) scale(${interpolate(
          enter,
          [0, 1],
          [0.88, 1],
        )})`,
        opacity: interpolate(enter, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        borderRadius: 52,
        padding: 12,
        background: `linear-gradient(160deg, ${C.silver}, #6b7391 40%, #232a52 75%, ${C.silver})`,
        boxShadow: `0 40px 120px -30px ${C.blue}bb, 0 0 0 1px #ffffff22`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 42,
          overflow: "hidden",
          background: C.ink,
          position: "relative",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            position: "absolute",
            top: panY,
            left: 0,
            width: "100%",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(120deg, #ffffff18 0%, transparent 35%, transparent 70%, #ffffff10 100%)`,
          }}
        />
      </div>
    </div>
  );
};
