import { describe, expect, it } from "vitest";
import { shouldShowPermissionsGate } from "./permissions-gate-logic";

describe("shouldShowPermissionsGate", () => {
  const base = {
    localMarker: null,
    signInEventCount: 1, // first sign-in row already inserted
    gpsConsentAt: null,
    elapsedMs: 0,
  } as const;

  it("shows the gate for a first-time user (1 sign-in, no consent)", () => {
    expect(shouldShowPermissionsGate({ ...base })).toBe(true);
  });

  it("hides once a second sign-in event registers the IP", () => {
    expect(shouldShowPermissionsGate({ ...base, signInEventCount: 2 })).toBe(false);
  });

  it("hides when profile already has a gps_consent_at decision", () => {
    expect(
      shouldShowPermissionsGate({ ...base, gpsConsentAt: "2026-01-01T00:00:00Z" }),
    ).toBe(false);
  });

  it("hides if local marker says we already asked on this device", () => {
    expect(shouldShowPermissionsGate({ ...base, localMarker: "granted" })).toBe(false);
  });

  it("falls back to hidden when both lookups are unknown past the window", () => {
    expect(
      shouldShowPermissionsGate({
        localMarker: null,
        signInEventCount: null,
        gpsConsentAt: undefined,
        elapsedMs: 5000,
      }),
    ).toBe(false);
  });

  it("still shows while lookups are unknown but within the window", () => {
    expect(
      shouldShowPermissionsGate({
        localMarker: null,
        signInEventCount: null,
        gpsConsentAt: undefined,
        elapsedMs: 1000,
      }),
    ).toBe(true);
  });
});
