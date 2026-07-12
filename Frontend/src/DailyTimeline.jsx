import { useRef, useState } from "react";
import { IconCheck, IconCircle } from "@tabler/icons-react";
import { snap, toMinutes, toTimeStr } from "./time";

const HOUR_PX = 52;
const MIN_DUR = 15;

// Drag a block to move it, drag its top/bottom edge to resize, click to edit.
export default function DailyTimeline({ items, onChange, onEditItem, onToggleDone }) {
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
    <div className="card flex overflow-y-auto max-h-[560px]">
      {/* Hour gutter */}
      <div className="w-16 shrink-0 text-right pr-2 text-[11px] text-faint select-none">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ height: HOUR_PX }} className="relative">
            <span className="absolute -top-2 right-2">{toTimeStr(h * 60)}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="relative flex-1" style={{ height: 24 * HOUR_PX }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ height: HOUR_PX }} className="border-t-[0.5px] border-line" />
        ))}

        {items.map((it, i) => {
          const live = drag?.index === i ? drag : null;
          const start = live ? live.start : toMinutes(it.start) ?? 540;
          const end = live ? live.end : toMinutes(it.end) ?? start + 60;
          return (
            <div
              key={i}
              className={`timeblock cat-${i % 6} absolute left-1 right-2 rounded-lg px-2 py-1 text-sm cursor-grab active:cursor-grabbing select-none ${live ? "ring-2 ring-accent-line" : ""} ${it.done && !live ? "opacity-50" : ""}`}
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
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleDone(i); }}
                title={it.done ? "Mark not done" : "Mark done"}
                className={`absolute top-1 right-1 grid place-items-center transition ${it.done ? "text-success" : "text-faint hover:text-ink"}`}
              >
                {it.done ? <IconCheck size={14} stroke={2} /> : <IconCircle size={14} stroke={1.75} />}
              </button>
              <div className={`font-medium truncate pr-5 ${it.done ? "line-through" : ""}`}>
                {it.name}
              </div>
              {end - start >= 45 && (
                <div className="text-xs opacity-75">
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
