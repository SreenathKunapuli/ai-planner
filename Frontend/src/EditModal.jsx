import { useState } from "react";
import { IconX } from "@tabler/icons-react";
import { MONTHS, from24h, to24h, toMinutes } from "./time";

// Edits one schedule item. Fields shown depend on planner type.
export default function EditModal({ type, item, maxDay, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item.name);
  const [start, setStart] = useState(type === "daily" ? to24h(item.start) : "");
  const [end, setEnd] = useState(type === "daily" ? to24h(item.end) : "");
  const [day, setDay] = useState(item.day ?? 1);
  const [month, setMonth] = useState(item.month ?? 1);
  const [done, setDone] = useState(item.done ?? false);
  const [err, setErr] = useState("");

  const save = () => {
    if (!name.trim()) return setErr("Name is required.");
    if (type === "daily") {
      if (!start || !end) return setErr("Start and end times are required.");
      const s = from24h(start), e = from24h(end);
      if (toMinutes(e) <= toMinutes(s)) return setErr("End must be after start.");
      onSave({ name: name.trim(), start: s, end: e, done });
    } else if (type === "monthly") {
      const d = Math.min(Math.max(1, Number(day) || 1), maxDay);
      onSave({ name: name.trim(), day: d, done });
    } else {
      onSave({ name: name.trim(), month: Number(month), done });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-sm rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-ink">Edit item</h3>
          <button onClick={onClose}
            className="text-dim hover:text-ink transition">
            <IconX size={16} stroke={1.75} />
          </button>
        </div>
        <div className="space-y-3">
          <input className="field" value={name} placeholder="Name"
            onChange={(e) => setName(e.target.value)} autoFocus />

          {type === "daily" && (
            <div className="flex gap-3">
              <label className="flex-1 text-sm text-dim">
                Start
                <input type="time" className="field mt-1" value={start}
                  onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="flex-1 text-sm text-dim">
                End
                <input type="time" className="field mt-1" value={end}
                  onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
          )}

          {type === "monthly" && (
            <label className="block text-sm text-dim">
              Day of month
              <input type="number" min={1} max={maxDay} className="field mt-1"
                value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
          )}

          {type === "yearly" && (
            <label className="block text-sm text-dim">
              Month
              <select className="field mt-1" value={month}
                onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 text-sm text-dim cursor-pointer">
            <input type="checkbox" checked={done} className="accent-accent h-4 w-4"
              onChange={(e) => setDone(e.target.checked)} />
            Completed
          </label>
        </div>

        {err && <p className="text-red-500 text-sm mt-3">{err}</p>}

        <div className="flex justify-between mt-5">
          <button onClick={onDelete}
            className="border-[0.5px] border-line text-red-500 hover:bg-sunken rounded-lg px-3 py-2 text-sm transition">
            Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-soft">
              Cancel
            </button>
            <button onClick={save} className="btn btn-primary">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
