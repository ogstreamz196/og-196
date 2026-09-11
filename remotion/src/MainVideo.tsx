import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Backdrop, useFade } from "./components/Backdrop";
import { Intro } from "./scenes/Intro";
import { PhoneScene } from "./scenes/PhoneScene";
import { FoulMouth } from "./scenes/FoulMouth";
import { EndCard } from "./scenes/EndCard";

export const TOTAL = 1110; // 37s @ 30fps

const Fade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const opacity = useFade(len, 14, 14);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

type Beat = { from: number; len: number; node: React.ReactNode };

const beats: Beat[] = [
  { from: 0, len: 130, node: <Intro /> },
  {
    from: 120,
    len: 190,
    node: (
      <PhoneScene
        kicker="One tap"
        words={["MAKE", "A", "TRACK", "ABOUT", "ANYONE"]}
        accentIndex={[4]}
        screenshot="images/home.png"
        chips={[{ label: "Name it" }, { label: "Say who it's for" }, { label: "Press CREATE NOW", tone: "red" }]}
        side="right"
        pan={-160}
      />
    ),
  },
  {
    from: 300,
    len: 190,
    node: (
      <PhoneScene
        kicker="Any sound, any tongue"
        words={["DRILL.", "GARAGE.", "AFROBEATS.", "BALLADS."]}
        accentIndex={[0, 2]}
        screenshot="images/library3.png"
        chips={[
          { label: "English", tone: "silver" },
          { label: "Urdu", tone: "silver" },
          { label: "Punjabi", tone: "silver" },
          { label: "Hindi", tone: "silver" },
          { label: "Gujarati", tone: "silver" },
          { label: "+ 40 more", tone: "blue" },
        ]}
        side="left"
        pan={-120}
        size={88}
      />
    ),
  },
  {
    from: 480,
    len: 190,
    node: (
      <PhoneScene
        kicker="Straight to your library"
        words={["REAL", "TRACKS.", "UP", "TO", "8", "MINUTES."]}
        accentIndex={[4, 5]}
        screenshot="images/library2.png"
        chips={[{ label: "Play" }, { label: "Download" }, { label: "Share", tone: "silver" }]}
        side="right"
        pan={-220}
        size={86}
      />
    ),
  },
  { from: 660, len: 210, node: <FoulMouth /> },
  {
    from: 860,
    len: 170,
    node: (
      <PhoneScene
        kicker="Coins, VIP and earnings"
        words={["EARN", "WHILE", "THEY", "PLAY"]}
        accentIndex={[0]}
        screenshot="images/earn2.png"
        chips={[{ label: "10% referral cut" }, { label: "Battle Zone purse", tone: "red" }]}
        side="left"
        pan={-140}
        size={92}
      />
    ),
  },
  { from: 1020, len: 90, node: <EndCard /> },
];

export const MainVideo: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    {beats.map((b, i) => (
      <Sequence key={i} from={b.from} durationInFrames={b.len}>
        <Fade len={b.len}>{b.node}</Fade>
      </Sequence>
    ))}
  </AbsoluteFill>
);
