import { describe, expect, it } from "vitest";
import { findOwnSpotifyApp, ownDeviceTypes } from "./ownSpotifyApp.ts";

const device = (name: string, type: string, isActive: boolean) => ({
  id: name,
  name,
  type,
  isActive,
});

describe("ownDeviceTypes", () => {
  it("tells computers, tablets and phones apart", () => {
    expect(ownDeviceTypes({ touch: false, shortSidePx: 1080 })).toEqual(["Computer"]);
    expect(ownDeviceTypes({ touch: true, shortSidePx: 800 })).toEqual(["Tablet", "Smartphone"]);
    expect(ownDeviceTypes({ touch: true, shortSidePx: 390 })).toEqual(["Smartphone", "Tablet"]);
  });
});

describe("findOwnSpotifyApp", () => {
  const types = ["Tablet", "Smartphone"];

  it("picks a device of this kind, not the PC", () => {
    const devices = [device("shadowfax", "Computer", true), device("Tab S9", "Tablet", false)];
    expect(findOwnSpotifyApp(devices, types)?.name).toBe("Tab S9");
  });

  it("prefers the active one, then the likelier type", () => {
    const phone = device("Pixel", "Smartphone", false);
    const tablet = device("Tab S9", "Tablet", false);
    expect(findOwnSpotifyApp([phone, tablet], types)?.name).toBe("Tab S9");
    expect(findOwnSpotifyApp([{ ...phone, isActive: true }, tablet], types)?.name).toBe("Pixel");
  });

  it("finds nothing while the app isn't open", () => {
    expect(findOwnSpotifyApp([device("shadowfax", "Computer", false)], types)).toBeNull();
  });
});
