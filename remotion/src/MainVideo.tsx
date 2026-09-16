import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from "remotion";
import { Backdrop, useFade } from "./components/Backdrop";
import { PromoIntro } from "./scenes/PromoIntro";
import { CreationTool } from "./scenes/CreationTool";
import { Languages } from "./scenes/Languages";
import { BattleZone } from "./scenes/BattleZone";
import { FinishedTrack } from "./scenes/FinishedTrack";
import { PromoEnd } from "./scenes/PromoEnd";

export const TOTAL = 1900; // ~63s @ 30fps

// Voiceover beats (frames)
const VO_INTRO_AT = 18; // 17.9s of narration
const VO_END_AT = 1610; // 7.9s closing narration

const Fade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const opacity = useFade(len, 14, 14);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

type Beat = { from: number; len: number; node: React.ReactNode };

const beats: Beat[] = [
  { from: 0, len: 310, node: <PromoIntro /> },
  { from: 300, len: 320, node: <CreationTool /> },
  { from: 610, len: 320, node: <Languages /> },
  { from: 920, len: 330, node: <BattleZone /> },
  { from: 1240, len: 320, node: <FinishedTrack /> },
  { from: 1550, len: 350, node: <PromoEnd /> },
];

// Music ducks under the narration, then swells to full for the showcase.
const musicVolume = (f: number) => {
  const swell = interpolate(f, [0, 20, 520, 600], [0, 0.1, 0.12, 0.95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const closingDuck = interpolate(f, [1580, 1615, 1860, 1890], [1, 0.34, 0.34, 0.9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outro = interpolate(f, [TOTAL - 45, TOTAL], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return swell * closingDuck * outro;
};

export const MainVideo: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <Audio src={staticFile("OG_PROMO.mp3")} startFrom={90} volume={musicVolume} />
    <Sequence from={VO_INTRO_AT}>
      <Audio src={staticFile("vo-intro.mp3")} volume={1} />
    </Sequence>
    <Sequence from={VO_END_AT}>
      <Audio src={staticFile("vo-end.mp3")} volume={1} />
    </Sequence>
    {beats.map((b, i) => (
      <Sequence key={i} from={b.from} durationInFrames={b.len}>
        <Fade len={b.len}>{b.node}</Fade>
      </Sequence>
    ))}
  </AbsoluteFill>
);
