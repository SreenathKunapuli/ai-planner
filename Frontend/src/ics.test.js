import { describe, expect, it } from "vitest";
import { buildICS } from "./ics";

describe("buildICS", () => {
  it("builds timed events for daily plans", () => {
    const ics = buildICS("daily", "2026-07-10",
      [{ name: "Gym", start: "9:00 AM", end: "10:30 AM" }], "My day");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20260710T090000");
    expect(ics).toContain("DTEND:20260710T103000");
    expect(ics).toContain("SUMMARY:Gym");
  });

  it("builds all-day events for monthly plans", () => {
    const ics = buildICS("monthly", "2026-07-01", [{ name: "Report", day: 15 }], "");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260715");
    expect(ics).toContain("DTEND;VALUE=DATE:20260716");
  });

  it("escapes special characters", () => {
    const ics = buildICS("daily", "2026-07-10",
      [{ name: "a,b;c", start: "9:00 AM", end: "10:00 AM" }], "");
    expect(ics).toContain("SUMMARY:a\\,b\\;c");
  });

  it("skips invalid items and returns null when empty", () => {
    expect(buildICS("daily", "2026-07-10",
      [{ name: "bad", start: "later", end: "sooner" }], "")).toBe(null);
    expect(buildICS("monthly", "2026-07-01", [{ name: "no day" }], "")).toBe(null);
  });

  it("handles month rollover for all-day DTEND", () => {
    const ics = buildICS("monthly", "2026-07-01", [{ name: "eom", day: 31 }], "");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260731");
    expect(ics).toContain("DTEND;VALUE=DATE:20260801");
  });
});
