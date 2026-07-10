// "9:00 AM" <-> minutes since midnight
export function toMinutes(str) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec((str || "").trim());
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3]?.toUpperCase() === "PM") h += 12;
  if (!m[3]) h = parseInt(m[1], 10); // 24h fallback
  return h * 60 + parseInt(m[2], 10);
}

export function toTimeStr(mins) {
  mins = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// "9:00 AM" <-> "09:00" (for <input type="time">)
export const to24h = (str) => {
  const mins = toMinutes(str);
  if (mins === null) return "";
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};
export const from24h = (v) => {
  const [h, m] = v.split(":").map(Number);
  return toTimeStr(h * 60 + m);
};

export const snap = (mins, step = 15) => Math.round(mins / step) * step;

export const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export function daysInMonth(isoDate) {
  const [y, m] = isoDate.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function firstWeekday(isoDate) {
  const [y, m] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, 1).getDay();
}
