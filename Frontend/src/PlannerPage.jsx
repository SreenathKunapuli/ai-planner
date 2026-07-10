import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import DailyTimeline from "./DailyTimeline";
import EditModal from "./EditModal";
import MonthGrid from "./MonthGrid";
import YearGrid from "./YearGrid";
import { daysInMonth } from "./time";

const TABS = [
  { key: "daily", label: "Daily" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

const btn = "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50";
const inputCls =
  "rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500";

const todayISO = () => new Date().toISOString().split("T")[0];

function defaultPeriod(type) {
  const t = todayISO();
  if (type === "daily") return t;
  if (type === "monthly") return t.slice(0, 7) + "-01";
  return t.slice(0, 4) + "-01-01";
}

function defaultNewItem(type, periodStart) {
  if (type === "daily") return { name: "New event", start: "9:00 AM", end: "10:00 AM" };
  if (type === "monthly") return { name: "New task", day: 1 };
  return { name: "New goal", month: 1 };
}

export default function PlannerPage() {
  const [type, setType] = useState("daily");
  const [periodStart, setPeriodStart] = useState(defaultPeriod("daily"));
  const [events, setEvents] = useState([]);
  const [evName, setEvName] = useState("");
  const [evDuration, setEvDuration] = useState("");
  const [requirement, setRequirement] = useState("");
  const [items, setItems] = useState(null);
  const [title, setTitle] = useState("");
  const [currentId, setCurrentId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSaved = useCallback(async (t) => {
    try {
      setSaved(await api.listSchedules(t));
    } catch {
      setSaved([]);
    }
  }, []);

  useEffect(() => { loadSaved(type); }, [type, loadSaved]);

  const switchTab = (t) => {
    setType(t);
    setPeriodStart(defaultPeriod(t));
    setItems(null);
    setCurrentId(null);
    setTitle("");
    setError("");
    setNotice("");
  };

  const addEvent = () => {
    if (!evName.trim()) return;
    setEvents([...events, { name: evName.trim(), duration: evDuration.trim() }]);
    setEvName("");
    setEvDuration("");
  };

  const generate = async () => {
    if (events.length === 0) return setError("Add at least one task first.");
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api.generate({ type, period_start: periodStart, events, requirement });
      setItems(data.items);
      setCurrentId(null);
      if (!title) setTitle(`${TABS.find(t => t.key === type).label} plan`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true); setError(""); setNotice("");
    const body = { type, period_start: periodStart, title, requirement, items };
    try {
      if (currentId) {
        await api.updateSchedule(currentId, body);
      } else {
        const row = await api.createSchedule(body);
        setCurrentId(row.id);
      }
      setNotice("Saved ✓");
      loadSaved(type);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openSaved = (s) => {
    setPeriodStart(s.period_start);
    setItems(s.items);
    setTitle(s.title);
    setRequirement(s.requirement || "");
    setCurrentId(s.id);
    setError(""); setNotice("");
  };

  const removeSaved = async (id) => {
    if (!confirm("Delete this schedule?")) return;
    try {
      await api.deleteSchedule(id);
      if (id === currentId) { setItems(null); setCurrentId(null); }
      loadSaved(type);
    } catch (e) {
      setError(e.message);
    }
  };

  const updateEditedItem = (updated) => {
    setItems(items.map((it, i) => (i === editIndex ? updated : it)));
    setEditIndex(null);
  };
  const deleteEditedItem = () => {
    setItems(items.filter((_, i) => i !== editIndex));
    setEditIndex(null);
  };

  const View = { daily: DailyTimeline, monthly: MonthGrid, yearly: YearGrid }[type];

  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-6">
      <div>
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1 w-fit mb-5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className={`${btn} ${type === t.key ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Period picker */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {type === "daily" && (
            <input type="date" className={inputCls} value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)} />
          )}
          {type === "monthly" && (
            <input type="month" className={inputCls} value={periodStart.slice(0, 7)}
              onChange={(e) => setPeriodStart(e.target.value + "-01")} />
          )}
          {type === "yearly" && (
            <input type="number" min="2000" max="2100" className={inputCls + " w-28"}
              value={periodStart.slice(0, 4)}
              onChange={(e) => setPeriodStart(`${e.target.value}-01-01`)} />
          )}
          <input className={inputCls + " flex-1 min-w-[160px]"} value={title}
            placeholder="Plan title (optional)" onChange={(e) => setTitle(e.target.value)} />
        </div>

        {/* Task input */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 mb-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">
            {type === "daily" ? "Events / tasks for the day"
              : type === "monthly" ? "Tasks for the month"
              : "Goals for the year"}
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            <input className={inputCls + " flex-1 min-w-[140px]"} value={evName}
              placeholder="Name" onChange={(e) => setEvName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEvent()} />
            <input className={inputCls + " w-40"} value={evDuration}
              placeholder="Time needed (e.g. 2h)" onChange={(e) => setEvDuration(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEvent()} />
            <button onClick={addEvent} className={`${btn} bg-slate-700 hover:bg-slate-600 text-white`}>
              Add
            </button>
          </div>
          {events.length > 0 && (
            <ul className="flex flex-wrap gap-2 mb-3">
              {events.map((ev, i) => (
                <li key={i} className="flex items-center gap-1.5 rounded-full bg-slate-800 border border-slate-700 pl-3 pr-1.5 py-1 text-sm">
                  {ev.name}{ev.duration && <span className="text-slate-400">· {ev.duration}</span>}
                  <button onClick={() => setEvents(events.filter((_, j) => j !== i))}
                    className="text-slate-500 hover:text-red-400 px-1">×</button>
                </li>
              ))}
            </ul>
          )}
          <input className={inputCls + " w-full"} value={requirement}
            placeholder="Requirements (e.g. lunch break at noon, gym in the evening)"
            onChange={(e) => setRequirement(e.target.value)} />
          <button onClick={generate} disabled={busy}
            className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white mt-3`}>
            {busy ? "Generating…" : "✨ Generate with AI"}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        {notice && <p className="text-emerald-400 text-sm mb-3">{notice}</p>}

        {/* Schedule view */}
        {items && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">
                Drag to move{type === "daily" ? ", stretch edges to resize" : ""}, click to edit.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setItems([...items, defaultNewItem(type, periodStart)])}
                  className={`${btn} border border-slate-700 hover:bg-slate-800`}>
                  + Add item
                </button>
                <button onClick={save} disabled={busy}
                  className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}>
                  {currentId ? "Update" : "Save"}
                </button>
              </div>
            </div>
            <View
              items={items}
              periodStart={periodStart}
              onChange={setItems}
              onEditItem={setEditIndex}
            />
          </div>
        )}
      </div>

      {/* Saved schedules */}
      <aside>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Saved {type} plans</h3>
        {saved.length === 0 && <p className="text-sm text-slate-600">Nothing saved yet.</p>}
        <ul className="space-y-1.5">
          {saved.map((s) => (
            <li key={s.id}
              className={`group flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${
                s.id === currentId
                  ? "border-indigo-500 bg-indigo-950/40"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-600"
              }`}
              onClick={() => openSaved(s)}>
              <span className="truncate">
                <span className="text-slate-400">{s.period_start}</span>
                {s.title && <span className="ml-2">{s.title}</span>}
              </span>
              <button onClick={(e) => { e.stopPropagation(); removeSaved(s.id); }}
                className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition ml-2">
                ✕
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {editIndex !== null && items?.[editIndex] && (
        <EditModal
          type={type}
          item={items[editIndex]}
          maxDay={daysInMonth(periodStart)}
          onSave={updateEditedItem}
          onDelete={deleteEditedItem}
          onClose={() => setEditIndex(null)}
        />
      )}
    </div>
  );
}
