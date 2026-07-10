import { toMinutes } from "./time";

// Minimal iCalendar export so plans open in Google/Apple/Outlook calendars.

const esc = (s) =>
  String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const fold = (line) => {
  // RFC 5545: lines over 75 octets are continued with CRLF + space.
  const out = [];
  while (line.length > 74) {
    out.push(line.slice(0, 74));
    line = " " + line.slice(74);
  }
  out.push(line);
  return out.join("\r\n");
};

const pad = (n) => String(n).padStart(2, "0");

function localStamp(dateISO, minutes) {
  const [y, m, d] = dateISO.split("-");
  return `${y}${m}${d}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;
}

function dateStamp(dateISO, addDays = 0) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d + addDays);
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
}

export function buildICS(type, periodStart, items, title) {
  const now = new Date();
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const events = [];
  items.forEach((it, i) => {
    const uid = `${periodStart}-${i}@ai-planner`;
    if (type === "daily") {
      const start = toMinutes(it.start);
      const end = toMinutes(it.end);
      if (start === null || end === null || end <= start) return;
      events.push([
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${localStamp(periodStart, start)}`,
        `DTEND:${localStamp(periodStart, end)}`,
        fold(`SUMMARY:${esc(it.name)}`),
        "END:VEVENT",
      ]);
    } else if (type === "monthly") {
      if (!it.day) return;
      const dayISO = periodStart.slice(0, 8) + pad(it.day);
      events.push([
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dateStamp(dayISO)}`,
        `DTEND;VALUE=DATE:${dateStamp(dayISO, 1)}`,
        fold(`SUMMARY:${esc(it.name)}`),
        "END:VEVENT",
      ]);
    }
  });
  if (!events.length) return null;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI Planner//EN",
    fold(`X-WR-CALNAME:${esc(title || "AI Planner")}`),
    ...events.flat(),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadICS(type, periodStart, items, title) {
  const ics = buildICS(type, periodStart, items, title);
  if (!ics) return false;
  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(title || "plan").replace(/[^\w-]+/g, "-").toLowerCase()}-${periodStart}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
