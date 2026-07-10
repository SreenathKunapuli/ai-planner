import { describe, expect, it } from "vitest";
import { daysInMonth, from24h, snap, to24h, toMinutes, toTimeStr } from "./time";

describe("toMinutes", () => {
  it("parses 12-hour times", () => {
    expect(toMinutes("9:00 AM")).toBe(540);
    expect(toMinutes("12:00 AM")).toBe(0); // midnight
    expect(toMinutes("12:30 PM")).toBe(750); // half past noon
    expect(toMinutes("11:59 PM")).toBe(1439);
  });
  it("parses 24-hour fallback", () => {
    expect(toMinutes("13:30")).toBe(810);
    expect(toMinutes("00:15")).toBe(15);
  });
  it("rejects garbage", () => {
    expect(toMinutes("")).toBe(null);
    expect(toMinutes(null)).toBe(null);
    expect(toMinutes("soon")).toBe(null);
  });
});

describe("toTimeStr", () => {
  it("formats and wraps", () => {
    expect(toTimeStr(0)).toBe("12:00 AM");
    expect(toTimeStr(750)).toBe("12:30 PM");
    expect(toTimeStr(1439)).toBe("11:59 PM");
    expect(toTimeStr(1445)).toBe("12:05 AM"); // wraps past midnight
  });
  it("round-trips with toMinutes", () => {
    for (const m of [0, 90, 540, 750, 1300]) {
      expect(toMinutes(toTimeStr(m))).toBe(m);
    }
  });
});

describe("24h conversion", () => {
  it("converts both directions", () => {
    expect(to24h("9:05 AM")).toBe("09:05");
    expect(to24h("11:59 PM")).toBe("23:59");
    expect(to24h("bogus")).toBe("");
    expect(from24h("14:30")).toBe("2:30 PM");
  });
});

describe("snap", () => {
  it("snaps to 15-minute grid", () => {
    expect(snap(7)).toBe(0);
    expect(snap(8)).toBe(15);
    expect(snap(52)).toBe(45);
  });
});

describe("daysInMonth", () => {
  it("handles month lengths and leap years", () => {
    expect(daysInMonth("2026-02-01")).toBe(28);
    expect(daysInMonth("2028-02-01")).toBe(29);
    expect(daysInMonth("2026-12-15")).toBe(31);
  });
});
