import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import DailyTimeline from "./DailyTimeline";
import EditModal from "./EditModal";
import { downloadICS } from "./ics";
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

// Local date, not UTC — toISOString() would shift the day near midnight.
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function defaultPeriod(type) {
  const t = todayISO();
  if (type === "daily") return t;
  if (type === "monthly") return t.slice(0, 7) + "-01";
  return t.slice(0, 4) + "-01-01";
}

function defaultNewItem(type) {
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
  const [nlText, setNlText] = useState("");
  const [requirement, setRequirement] = useState("");
  const [items, setItems] = useState(null);
  const [prevItems, setPrevItems] = useState(null); // one-level undo after AI refine
  const [refineText, setRefineText] = useState("");
  const [title, setTitle] = useState("");
  const [currentId, setCurrentId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [busy, setBusy] = useState(null); // "generate" | "refine" | "parse" | "save"
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

  const clearMessages = () => { setError(""); setNotice(""); };

  const switchTab = (t) => {
    setType(t);
    setPeriodStart(defaultPeriod(t));
    setItems(null);
    setPrevItems(null);
    setCurrentId(null);
    setTitle("");
    setEditIndex(null);
    clearMessages();
  };

  const addEvent = () => {
    if (!evName.trim()) return;
    setEvents([...events, { name: evName.trim(), duration: evDuration.trim() }]);
    setEvName("");
    setEvDuration("");
  };

  const parseNL = async () => {
    if (!nlText.trim()) return;
    setBusy("parse"); clearMessages();
    try {
      const data = await api.parseTasks(nlText);
      if (!data.events.length) {
        setError("Couldn't find any tasks in that text.");
      } else {
        setEvents([...events, ...data.events]);
        setNlText("");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (events.length === 0) return setError("Add at least one task first.");
    setBusy("generate"); clearMessages();
    try {
      const data = await api.generate({ type, period_start: periodStart, events, requirement });
      setItems(data.items);
      setPrevItems(null);
      setCurrentId(null);
      if (!title) setTitle(`${TABS.find(t => t.key === type).label} plan`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const refine = async () => {
    if (!refineText.trim() || !items?.length) return;
    setBusy("refine"); clearMessages();
    try {
      const data = await api.refine({
        type, period_start: periodStart, items, instruction: refineText,
      });
      setPrevItems(items);
      setItems(data.items);
      setRefineText("");
      setNotice("Plan updated — Undo if it missed the mark.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const undoRefine = () => {
    if (!prevItems) return;
    setItems(prevItems);
    setPrevItems(null);
    setNotice("Restored the previous plan.");
  };

  const save = async () => {
    setBusy("save"); clearMessages();
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
      setBusy(null);
    }
  };

  const openSaved = (s, asCopy = false) => {
    setPeriodStart(s.period_start);
    setItems(s.items);
    setPrevItems(null);
    setTitle(asCopy && s.title ? `${s.title} (copy)` : s.title);
    setRequirement(s.requirement || "");
    setCurrentId(asCopy ? null : s.id);
    clearMessages();
    if (asCopy) setNotice("Editing a copy — Save to keep it.");
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

  const exportICS = () => {
    if (!downloadICS(type, periodStart, items, title)) {
      setError("Nothing exportable in this plan yet.");
    }
  };

  const toggleDone = (i) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, done: !it.done } : it)));

  const updateEditedItem = (updated) => {
    setItems(items.map((it, i) => (i === editIndex ? updated : it)));
    setEditIndex(null);
  };
  const deleteEditedItem = () => {
    setItems(items.filter((_, i) => i !== editIndex));
    setEditIndex(null);
  };

  const View = { daily: DailyTimeline, monthly: MonthGrid, yearly: YearGrid }[type];
  const doneCount = items?.filter((it) => it.done).length ?? 0;

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
              onChange={(e) => e.target.value && setPeriodStart(e.target.value)} />
          )}
          {type === "monthly" && (
            <input type="month" className={inputCls} value={periodStart.slice(0, 7)}
              onChange={(e) => e.target.value && setPeriodStart(e.target.value + "-01")} />
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

          {/* Natural-language quick add */}
          <div className="flex flex-wrap gap-2 mb-3">
            <input className={inputCls + " flex-1 min-w-[200px]"} value={nlText}
              placeholder='Or describe them all at once: "gym for an hour, 3h of studying, call mom"'
              onChange={(e) => setNlText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && parseNL()} />
            <button onClick={parseNL} disabled={busy !== null || !nlText.trim()}
              className={`${btn} border border-indigo-700 text-indigo-300 hover:bg-indigo-950`}>
              {busy === "parse" ? "Reading…" : "✨ Add with AI"}
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
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button onClick={generate} disabled={busy !== null}
              className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}>
              {busy === "generate" ? "Generating…" : "✨ Generate with AI"}
            </button>
            {events.length > 0 && (
              <button onClick={() => setEvents([])}
                className={`${btn} text-slate-500 hover:text-slate-300`}>
                Clear tasks
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        {notice && (
          <p className="text-emerald-400 text-sm mb-3">
            {notice}
            {prevItems && (
              <button onClick={undoRefine} className="ml-2 underline hover:text-emerald-300">
                Undo
              </button>
            )}
          </p>
        )}

        {/* Schedule view */}
        {items ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs text-slate-500">
                Drag to move{type === "daily" ? ", stretch edges to resize" : ""}, click to edit.
                {items.length > 0 && ` · ${doneCount}/${items.length} done`}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setItems([...items, defaultNewItem(type)])}
                  className={`${btn} border border-slate-700 hover:bg-slate-800`}>
                  + Add item
                </button>
                {type !== "yearly" && items.length > 0 && (
                  <button onClick={exportICS}
                    className={`${btn} border border-slate-700 hover:bg-slate-800`}
                    title="Download as .ics for Google/Apple Calendar">
                    ⤓ Calendar
                  </button>
                )}
                <button onClick={save} disabled={busy !== null}
                  className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}>
                  {busy === "save" ? "Saving…" : currentId ? "Update" : "Save"}
                </button>
              </div>
            </div>

            <View
              items={items}
              periodStart={periodStart}
              onChange={setItems}
              onEditItem={setEditIndex}
              onToggleDone={toggleDone}
            />

            {/* AI refine */}
            <div className="flex flex-wrap gap-2 mt-3">
              <input className={inputCls + " flex-1 min-w-[200px]"} value={refineText}
                placeholder='Tell AI what to change: "move gym before lunch and add a reading block"'
                onChange={(e) => setRefineText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refine()} />
              <button onClick={refine} disabled={busy !== null || !refineText.trim()}
                className={`${btn} bg-violet-600 hover:bg-violet-500 text-white`}>
                {busy === "refine" ? "Refining…" : "✨ Refine"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 py-16 text-center">
            <p className="text-slate-500">Your schedule will appear here.</p>
            <p className="text-slate-600 text-sm mt-1">
              Add tasks above and let AI arrange them — or open a saved plan.
            </p>
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
              <span className="flex items-center shrink-0">
                <button onClick={(e) => { e.stopPropagation(); openSaved(s, true); }}
                  title="Duplicate"
                  className="text-slate-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition ml-2">
                  ⧉
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeSaved(s.id); }}
                  title="Delete"
                  className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition ml-2">
                  ✕
                </button>
              </span>
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
