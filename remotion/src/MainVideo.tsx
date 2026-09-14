import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Backdrop, useFade } from "./components/Backdrop";
import { PromoIntro } from "./scenes/PromoIntro";
import { CreationTool } from "./scenes/CreationTool";
import { Languages } from "./scenes/Languages";
import { BattleZone } from "./scenes/BattleZone";
import { FinishedTrack } from "./scenes/FinishedTrack";
import { PromoEnd } from "./scenes/PromoEnd";

export const TOTAL = 1800; // 60s @ 30fps

const Fade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const opacity = useFade(len, 14, 14);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

type Beat = { from: number; len: number; node: React.ReactNode };

const beats: Beat[] = [
  { from: 0, len: 300, node: <PromoIntro /> },
  { from: 290, len: 310, node: <CreationTool /> },
  { from: 590, len: 310, node: <Languages /> },
  { from: 890, len: 320, node: <BattleZone /> },
  { from: 1200, len: 310, node: <FinishedTrack /> },
  { from: 1500, len: 300, node: <PromoEnd /> },
];

export const MainVideo: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <Audio src={staticFile("OG_PROMO.mp3")} startFrom={90} volume={0.88} />
    {beats.map((b, i) => (
      <Sequence key={i} from={b.from} durationInFrames={b.len}>
        <Fade len={b.len}>{b.node}</Fade>
      </Sequence>
    ))}
  </AbsoluteFill>
);
