import { describe, it, expect } from "vitest";
import {
  decideInstallPrompt,
  isIosSafari,
  type InstallEnv,
} from "@/components/install-prompt";

// Realistic UA strings for the platform-detection branch.
const IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IOS_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// Sensible mobile baseline: touch viewport, not installed, not dismissed.
function base(overrides: Partial<InstallEnv> = {}): InstallEnv {
  return {
    userAgent: ANDROID_CHROME,
    isStandalone: false,
    isMobile: true,
    dismissed: false,
    hasBeforeInstall: false,
    ...overrides,
  };
}

describe("isIosSafari", () => {
  it("detects iOS Safari", () => {
    expect(isIosSafari(IOS_SAFARI)).toBe(true);
  });
  it("rejects iOS Chrome (CriOS)", () => {
    expect(isIosSafari(IOS_CHROME)).toBe(false);
  });
  it("rejects Android Chrome", () => {
    expect(isIosSafari(ANDROID_CHROME)).toBe(false);
  });
  it("rejects desktop Chrome", () => {
    expect(isIosSafari(DESKTOP_CHROME)).toBe(false);
  });
  it("handles empty UA safely", () => {
    expect(isIosSafari("")).toBe(false);
  });
});

describe("decideInstallPrompt", () => {
  it("shows the Android prompt when beforeinstallprompt was captured", () => {
    expect(decideInstallPrompt(base({ hasBeforeInstall: true }))).toEqual({
      show: true,
      platform: "android",
    });
  });

  it("shows the iOS instructions on iOS Safari with no event", () => {
    expect(
      decideInstallPrompt(base({ userAgent: IOS_SAFARI, hasBeforeInstall: false })),
    ).toEqual({ show: true, platform: "ios" });
  });

  it("hides on desktop even with a captured event", () => {
    expect(
      decideInstallPrompt(base({ isMobile: false, hasBeforeInstall: true })),
    ).toEqual({ show: false });
  });

  it("hides when already installed (standalone)", () => {
    expect(
      decideInstallPrompt(base({ isStandalone: true, hasBeforeInstall: true })),
    ).toEqual({ show: false });
  });

  it("hides when previously dismissed", () => {
    expect(
      decideInstallPrompt(base({ dismissed: true, hasBeforeInstall: true })),
    ).toEqual({ show: false });
  });

  it("hides on iOS when dismissed", () => {
    expect(
      decideInstallPrompt(base({ userAgent: IOS_SAFARI, dismissed: true })),
    ).toEqual({ show: false });
  });

  it("hides on a mobile browser that is neither iOS Safari nor beforeinstallprompt-capable", () => {
    expect(
      decideInstallPrompt(base({ userAgent: IOS_CHROME, hasBeforeInstall: false })),
    ).toEqual({ show: false });
  });

  it("prioritizes standalone over a captured event and iOS UA", () => {
    expect(
      decideInstallPrompt(
        base({ userAgent: IOS_SAFARI, isStandalone: true, hasBeforeInstall: true }),
      ),
    ).toEqual({ show: false });
  });
});
