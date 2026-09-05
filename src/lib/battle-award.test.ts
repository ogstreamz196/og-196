import { describe, expect, it } from "vitest";
import { calibrateAward } from "./community.functions";

describe("calibrateAward", () => {
  it("gives nothing for empty or repeated messages", () => {
    expect(calibrateAward(8, "   ", 0, false)).toBe(0);
    expect(calibrateAward(8, "same line", 0, true)).toBe(0);
  });

  it("always banks something for a genuine attempt", () => {
    expect(calibrateAward(0, "you sound like a broken kettle", 0, false)).toBe(1);
  });

  it("keeps one-word grunts at zero", () => {
    expect(calibrateAward(0, "lol", 0, false)).toBe(0);
  });

  it("caps hot streaks so nobody farms max rewards", () => {
    expect(calibrateAward(10, "a properly savage roast line", 7.5, false)).toBe(6);
    expect(calibrateAward(10, "a properly savage roast line", 5.5, false)).toBe(8);
    expect(calibrateAward(10, "a properly savage roast line", 2, false)).toBe(10);
  });
});
