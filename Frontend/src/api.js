import supabase from "./supabase-client";

const API = import.meta.env.DEV ? "http://localhost:8000" : "";

async function request(method, path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  generate: (body) => request("POST", "/api/generate", body),
  refine: (body) => request("POST", "/api/refine", body),
  parseTasks: (text) => request("POST", "/api/parse-tasks", { text }),
  listSchedules: (type) => request("GET", `/api/schedules?type=${type}`),
  createSchedule: (body) => request("POST", "/api/schedules", body),
  updateSchedule: (id, body) => request("PUT", `/api/schedules/${id}`, body),
  deleteSchedule: (id) => request("DELETE", `/api/schedules/${id}`),
};
