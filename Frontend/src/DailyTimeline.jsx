import { useRef, useState } from "react";
import { snap, toMinutes, toTimeStr } from "./time";

const HOUR_PX = 52;
const MIN_DUR = 15;
const COLORS = [
  "bg-indigo-600/80 border-indigo-400",
  "bg-emerald-600/80 border-emerald-400",
  "bg-rose-600/80 border-rose-400",
  "bg-amber-600/80 border-amber-400",
  "bg-cyan-600/80 border-cyan-400",
  "bg-violet-600/80 border-violet-400",
];

// Drag a block to move it, drag its top/bottom edge to resize, click to edit.
export default function DailyTimeline({ items, onChange, onEditItem }) {
  const [drag, setDrag] = useState(null); // {index, start, end}
  const gesture = useRef(null);

  const startGesture = (e, index, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const it = items[index];
    const start = toMinutes(it.start) ?? 540;
    const end = toMinutes(it.end) ?? start + 60;
    gesture.current = { index, mode, y0: e.clientY, start, end, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const dy = e.clientY - g.y0;
    if (Math.abs(dy) > 4) g.moved = true;
    const dMin = snap((dy / HOUR_PX) * 60);
    let { start, end } = g;
    const dur = end - start;
    if (g.mode === "move") {
      start = Math.min(Math.max(0, start + dMin), 1440 - dur);
      end = start + dur;
    } else if (g.mode === "resize-end") {
      end = Math.min(1440, Math.max(start + MIN_DUR, end + dMin));
    } else {
      start = Math.max(0, Math.min(end - MIN_DUR, start + dMin));
    }
    setDrag({ index: g.index, start, end });
  };

  const onPointerUp = () => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    if (!g.moved) {
      setDrag(null);
      onEditItem(g.index);
      return;
    }
    if (drag) {
      const next = items.map((it, i) =>
        i === drag.index
          ? { ...it, start: toTimeStr(drag.start), end: toTimeStr(drag.end) }
          : it
      );
      onChange(next);
    }
    setDrag(null);
  };

  return (
    <div className="flex rounded-xl border border-slate-800 bg-slate-900/50 overflow-y-auto max-h-[560px]">
      {/* Hour gutter */}
      <div className="w-16 shrink-0 text-right pr-2 text-xs text-slate-500 select-none">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ height: HOUR_PX }} className="relative">
            <span className="absolute -top-2 right-2">{toTimeStr(h * 60)}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="relative flex-1" style={{ height: 24 * HOUR_PX }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ height: HOUR_PX }}
            className="border-t border-slate-800/70" />
        ))}

        {items.map((it, i) => {
          const live = drag?.index === i ? drag : null;
          const start = live ? live.start : toMinutes(it.start) ?? 540;
          const end = live ? live.end : toMinutes(it.end) ?? start + 60;
          return (
            <div
              key={i}
              className={`absolute left-1 right-2 rounded-lg border-l-4 px-2 py-1 text-sm text-white shadow-md cursor-grab active:cursor-grabbing select-none ${COLORS[i % COLORS.length]} ${live ? "opacity-90 ring-2 ring-white/40" : ""}`}
              style={{
                top: (start / 60) * HOUR_PX,
                height: Math.max(((end - start) / 60) * HOUR_PX, 20),
                touchAction: "none",
              }}
              onPointerDown={(e) => startGesture(e, i, "move")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <div
                className="absolute inset-x-0 top-0 h-2 cursor-ns-resize"
                onPointerDown={(e) => startGesture(e, i, "resize-start")}
              />
              <div className="font-medium truncate">{it.name}</div>
              {end - start >= 45 && (
                <div className="text-xs text-white/80">
                  {toTimeStr(start)} – {toTimeStr(end)}
                </div>
              )}
              <div
                className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                onPointerDown={(e) => startGesture(e, i, "resize-end")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
