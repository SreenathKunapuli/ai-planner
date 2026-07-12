import { useState } from "react";
import { daysInMonth, firstWeekday } from "./time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Calendar grid; drag chips between days, click a chip to edit.
export default function MonthGrid({ periodStart, items, onChange, onEditItem }) {
  const [overDay, setOverDay] = useState(null);
  const total = daysInMonth(periodStart);
  const offset = firstWeekday(periodStart);
  const cells = Array.from({ length: offset + total }, (_, i) =>
    i < offset ? null : i - offset + 1
  );
  const t = todayISO();
  const todayDay = t.slice(0, 7) === periodStart.slice(0, 7) ? Number(t.slice(8, 10)) : null;

  const dropOn = (day, e) => {
    e.preventDefault();
    setOverDay(null);
    const idx = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(idx) || !items[idx]) return;
    onChange(items.map((it, i) => (i === idx ? { ...it, day } : it)));
  };

  return (
    <div className="card p-2">
      <div className="grid grid-cols-7 text-center text-[11px] text-faint mb-1">
        {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, ci) =>
          day === null ? (
            <div key={`e${ci}`} />
          ) : (
            <div
              key={day}
              onDragOver={(e) => { e.preventDefault(); setOverDay(day); }}
              onDragLeave={() => setOverDay(null)}
              onDrop={(e) => dropOn(day, e)}
              className={`min-h-[84px] rounded-md border-[0.5px] p-1 transition ${
                overDay === day || day === todayDay
                  ? "border-accent-line bg-accent-soft"
                  : "border-line bg-surface"
              }`}
            >
              <div className={`text-[11px] mb-1 ${day === todayDay ? "text-accent font-medium" : "text-faint"}`}>
                {day}
              </div>
              <div className="space-y-1">
                {items.map((it, i) =>
                  it.day === day ? (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                      onClick={() => onEditItem(i)}
                      className={`tint-chip cat-${i % 6} truncate cursor-grab ${it.done ? "line-through opacity-50" : ""}`}
                      title={it.name}
                    >
                      {it.name}
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
