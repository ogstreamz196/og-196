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

  it("keeps showing if only sign_in_events is delayed but consent is null", () => {
    // Profile loaded (no consent yet), sign_in_events still pending: still first-time.
    expect(
      shouldShowPermissionsGate({
        localMarker: null,
        signInEventCount: null,
        gpsConsentAt: null,
        elapsedMs: 500,
      }),
    ).toBe(true);
  });

  it("hides when sign_in_events is delayed but consent already exists", () => {
    expect(
      shouldShowPermissionsGate({
        localMarker: null,
        signInEventCount: null,
        gpsConsentAt: "2026-06-01T00:00:00Z",
        elapsedMs: 500,
      }),
    ).toBe(false);
  });

  it("hides when profile row is missing but IP is already registered", () => {
    expect(
      shouldShowPermissionsGate({
        localMarker: null,
        signInEventCount: 3,
        gpsConsentAt: undefined,
        elapsedMs: 100,
      }),
    ).toBe(false);
  });

  it("respects a custom fallback window", () => {
    const inputs = {
      localMarker: null,
      signInEventCount: null,
      gpsConsentAt: undefined,
      elapsedMs: 1500,
    };
    expect(shouldShowPermissionsGate({ ...inputs, fallbackMs: 1000 })).toBe(false);
    expect(shouldShowPermissionsGate({ ...inputs, fallbackMs: 5000 })).toBe(true);
  });

  it("never gets stuck: at very large elapsedMs with no data, hides", () => {
    expect(
      shouldShowPermissionsGate({
        localMarker: null,
        signInEventCount: null,
        gpsConsentAt: undefined,
        elapsedMs: 60_000,
      }),
    ).toBe(false);
  });
});
