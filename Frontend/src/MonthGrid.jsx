import { useState } from "react";
import { daysInMonth, firstWeekday } from "./time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHIP_COLORS = [
  "bg-indigo-600/70", "bg-emerald-600/70", "bg-rose-600/70",
  "bg-amber-600/70", "bg-cyan-600/70", "bg-violet-600/70",
];

// Calendar grid; drag chips between days, click a chip to edit.
export default function MonthGrid({ periodStart, items, onChange, onEditItem }) {
  const [overDay, setOverDay] = useState(null);
  const total = daysInMonth(periodStart);
  const offset = firstWeekday(periodStart);
  const cells = Array.from({ length: offset + total }, (_, i) =>
    i < offset ? null : i - offset + 1
  );

  const dropOn = (day, e) => {
    e.preventDefault();
    setOverDay(null);
    const idx = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(idx) || !items[idx]) return;
    onChange(items.map((it, i) => (i === idx ? { ...it, day } : it)));
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2">
      <div className="grid grid-cols-7 text-center text-xs text-slate-500 mb-1">
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
              className={`min-h-[84px] rounded-lg border p-1 transition ${
                overDay === day
                  ? "border-indigo-500 bg-indigo-950/50"
                  : "border-slate-800 bg-slate-900"
              }`}
            >
              <div className="text-xs text-slate-500 mb-1">{day}</div>
              <div className="space-y-1">
                {items.map((it, i) =>
                  it.day === day ? (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                      onClick={() => onEditItem(i)}
                      className={`${CHIP_COLORS[i % CHIP_COLORS.length]} rounded px-1.5 py-0.5 text-xs text-white truncate cursor-grab hover:brightness-110`}
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
