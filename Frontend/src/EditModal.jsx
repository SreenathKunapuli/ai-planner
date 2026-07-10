import { useState } from "react";
import { MONTHS, from24h, to24h, toMinutes } from "./time";

const inputCls =
  "w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-indigo-500";

// Edits one schedule item. Fields shown depend on planner type.
export default function EditModal({ type, item, maxDay, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item.name);
  const [start, setStart] = useState(type === "daily" ? to24h(item.start) : "");
  const [end, setEnd] = useState(type === "daily" ? to24h(item.end) : "");
  const [day, setDay] = useState(item.day ?? 1);
  const [month, setMonth] = useState(item.month ?? 1);
  const [err, setErr] = useState("");

  const save = () => {
    if (!name.trim()) return setErr("Name is required.");
    if (type === "daily") {
      if (!start || !end) return setErr("Start and end times are required.");
      const s = from24h(start), e = from24h(end);
      if (toMinutes(e) <= toMinutes(s)) return setErr("End must be after start.");
      onSave({ name: name.trim(), start: s, end: e });
    } else if (type === "monthly") {
      const d = Math.min(Math.max(1, Number(day) || 1), maxDay);
      onSave({ name: name.trim(), day: d });
    } else {
      onSave({ name: name.trim(), month: Number(month) });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl">
        <h3 className="font-semibold mb-4">Edit item</h3>
        <div className="space-y-3">
          <input className={inputCls} value={name} placeholder="Name"
            onChange={(e) => setName(e.target.value)} autoFocus />

          {type === "daily" && (
            <div className="flex gap-3">
              <label className="flex-1 text-sm text-slate-400">
                Start
                <input type="time" className={inputCls + " mt-1"} value={start}
                  onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="flex-1 text-sm text-slate-400">
                End
                <input type="time" className={inputCls + " mt-1"} value={end}
                  onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
          )}

          {type === "monthly" && (
            <label className="block text-sm text-slate-400">
              Day of month
              <input type="number" min={1} max={maxDay} className={inputCls + " mt-1"}
                value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
          )}

          {type === "yearly" && (
            <label className="block text-sm text-slate-400">
              Month
              <select className={inputCls + " mt-1"} value={month}
                onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {err && <p className="text-red-400 text-sm mt-3">{err}</p>}

        <div className="flex justify-between mt-5">
          <button onClick={onDelete}
            className="rounded-lg px-3 py-2 text-sm text-red-400 border border-red-900/60 hover:bg-red-950 transition">
            Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm border border-slate-700 hover:bg-slate-800 transition">
              Cancel
            </button>
            <button onClick={save}
              className="rounded-lg px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 font-medium transition">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
