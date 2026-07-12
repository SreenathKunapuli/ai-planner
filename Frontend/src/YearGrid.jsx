import { useState } from "react";
import { MONTHS } from "./time";

// 12-month grid; drag chips between months, click a chip to edit.
export default function YearGrid({ periodStart, items, onChange, onEditItem }) {
  const [overMonth, setOverMonth] = useState(null);
  const now = new Date();
  const nowMonth =
    periodStart && Number(periodStart.slice(0, 4)) === now.getFullYear()
      ? now.getMonth() + 1
      : null;

  const dropOn = (month, e) => {
    e.preventDefault();
    setOverMonth(null);
    const idx = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(idx) || !items[idx]) return;
    onChange(items.map((it, i) => (i === idx ? { ...it, month } : it)));
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {MONTHS.map((name, mi) => {
        const month = mi + 1;
        return (
          <div
            key={name}
            onDragOver={(e) => { e.preventDefault(); setOverMonth(month); }}
            onDragLeave={() => setOverMonth(null)}
            onDrop={(e) => dropOn(month, e)}
            className={`min-h-[110px] rounded-xl border-[0.5px] p-2 transition ${
              overMonth === month
                ? "border-accent-line bg-accent-soft"
                : month === nowMonth
                ? "border-accent-line bg-surface"
                : "border-line bg-surface"
            }`}
          >
            <div className={`text-sm font-medium mb-1.5 ${month === nowMonth ? "text-accent" : "text-ink"}`}>
              {name}
            </div>
            <div className="space-y-1">
              {items.map((it, i) =>
                it.month === month ? (
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
        );
      })}
    </div>
  );
}
