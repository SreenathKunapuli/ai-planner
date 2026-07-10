import { useState } from "react";
import { MONTHS } from "./time";

const CHIP_COLORS = [
  "bg-indigo-600/70", "bg-emerald-600/70", "bg-rose-600/70",
  "bg-amber-600/70", "bg-cyan-600/70", "bg-violet-600/70",
];

// 12-month grid; drag chips between months, click a chip to edit.
export default function YearGrid({ items, onChange, onEditItem }) {
  const [overMonth, setOverMonth] = useState(null);

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
            className={`min-h-[110px] rounded-xl border p-2 transition ${
              overMonth === month
                ? "border-indigo-500 bg-indigo-950/50"
                : "border-slate-800 bg-slate-900/50"
            }`}
          >
            <div className="text-sm font-medium text-slate-300 mb-1.5">{name}</div>
            <div className="space-y-1">
              {items.map((it, i) =>
                it.month === month ? (
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
        );
      })}
    </div>
  );
}
