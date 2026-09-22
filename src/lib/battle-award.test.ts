import { describe, expect, it } from "vitest";
import { calibrateAward, estimateRoastFloor } from "./community.functions";

describe("estimateRoastFloor", () => {
  it("recognises clear insults even if the external judge returns zero", () => {
    expect(estimateRoastFloor("Ok go fuck ur mum")).toBeGreaterThanOrEqual(3);
    expect(estimateRoastFloor("Suck her left testical")).toBeGreaterThanOrEqual(3);
    expect(estimateRoastFloor("Dese nuts on ur mums chin")).toBeGreaterThanOrEqual(3);
    expect(estimateRoastFloor("I will put two O and a big 1 in ur mums bum")).toBeGreaterThanOrEqual(3);
  });

  it("does not reward normal messages, diagnostics, or profanity without a target", () => {
    expect(estimateRoastFloor("hello everyone")).toBe(0);
    expect(estimateRoastFloor("why did you run out of room again")).toBe(0);
    expect(estimateRoastFloor("this is fucking brilliant")).toBe(0);
  });
});

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
