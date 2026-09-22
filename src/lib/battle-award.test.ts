import { describe, expect, it } from "vitest";
import { calibrateAward } from "./community.functions";

describe("calibrateAward", () => {
  it("gives nothing for empty or repeated messages", () => {
    expect(calibrateAward(8, "   ", 0, false)).toBe(0);
    expect(calibrateAward(8, "same line", 0, true)).toBe(0);
  });

  it("does not award random chat or generic insults", () => {
    expect(calibrateAward(0, "how is everyone doing today?", 0, false, () => 0)).toBe(0);
    expect(calibrateAward(2, "you are rubbish", 0, false, () => 0.9)).toBe(0);
  });

  it("keeps one-word grunts at zero", () => {
    expect(calibrateAward(0, "lol", 0, false)).toBe(0);
  });

  it("randomises drops inside quality bands", () => {
    expect(calibrateAward(3, "a decent original roast line", 0, false, () => 0)).toBe(1);
    expect(calibrateAward(3, "a decent original roast line", 0, false, () => 0.99)).toBe(2);
    expect(calibrateAward(7, "a strong original roast line", 0, false, () => 0)).toBe(4);
    expect(calibrateAward(7, "a strong original roast line", 0, false, () => 0.99)).toBe(7);
  });

  it("reserves the biggest drops for exceptional insults", () => {
    expect(calibrateAward(10, "an elite devastating original punchline", 8, false, () => 0)).toBe(7);
    expect(calibrateAward(10, "an elite devastating original punchline", 8, false, () => 0.99)).toBe(10);
  });
});
