"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

type Truck = { id: string; name: string; org_id?: string };
type Template = { id: string; name: string; org_id?: string };
type Reminder = {
  id: string;
  truck_id: string;
  template_id: string;
  tz: string;
  hour_local: number;
  minute_local: number;
  enabled: boolean;
  last_run_on: string | null;
};

export default function RemindersPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <RemindersInner />
    </Suspense>
  );
}

function RemindersInner() {
  const [log, setLog] = useState<string[]>([]);

  // Org + reference lists
  const [orgId, setOrgId] = useState<string>("");
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [rows, setRows] = useState<Reminder[]>([]);

  // Form state
  const [truckId, setTruckId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [tz, setTz] = useState("America/Los_Angeles");
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [busy, setBusy] = useState(false);

  // Load org, trucks, templates, reminders
  useEffect(() => {
    (async () => {
      setLog([]);
      // Find the user's org
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLog((l) => [...l, "Not signed in"]);
        return;
      }

      const mem = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (mem.error) setLog((l) => [...l, `org member error: ${mem.error.message}`]);
      if (mem.data?.org_id) setOrgId(mem.data.org_id);

      // Load lists (RLS will scope to your org)
      const [tr, tp, rm] = await Promise.all([
        supabase.from("trucks").select("id,name,org_id").order("name"),
        supabase.from("templates").select("id,name,org_id").order("name"),
        supabase.from("reminders").select("*").order("created_at", { ascending: false }),
      ]);

      if (tr.error) setLog((l) => [...l, `trucks error: ${tr.error.message}`]);
      if (tp.error) setLog((l) => [...l, `templates error: ${tp.error.message}`]);
      if (rm.error) setLog((l) => [...l, `reminders load error: ${rm.error.message}`]);

      setTrucks((tr.data || []) as Truck[]);
      setTemplates((tp.data || []) as Template[]);
      setRows((rm.data || []) as Reminder[]);

      // Preselect first options
      if (tr.data?.[0]) setTruckId(tr.data[0].id);
      if (tp.data?.[0]) setTemplateId(tp.data[0].id);
    })();
  }, []);

  // Create or update (UPSERT) a reminder for the truck/template pair
  async function createReminder() {
    if (!truckId || !templateId) return;
    if (!orgId) {
      setLog((l) => [...l, "No org membership found; cannot create reminder."]);
      return;
    }
    setBusy(true);
    setLog([]);
    try {
      const { data: u } = await supabase.auth.getUser();

      const up = await supabase
        .from("reminders")
        .upsert(
          {
            org_id: orgId,
            truck_id: truckId,
            template_id: templateId,
            tz,
            hour_local: hour,
            minute_local: minute,
            enabled: true,
            created_by: u.user?.id ?? null,
          },
          { onConflict: "truck_id,template_id" }
        )
        .select("*")
        .single();

      if (up.error) {
        setLog((l) => [...l, `create/update error: ${up.error.message}`]);
        return;
      }

      // Replace if exists, else add to top
      setRows((prev) => {
        const others = prev.filter(
          (r) => !(r.truck_id === truckId && r.template_id === templateId)
        );
        return [up.data as Reminder, ...others];
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: Reminder, enabled: boolean) {
    const res = await supabase
      .from("reminders")
      .update({ enabled })
      .eq("id", row.id)
      .select("*")
      .single();
    if (res.error) {
      setLog((l) => [...l, `toggle error: ${res.error.message}`]);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? (res.data as Reminder) : r)));
  }

  async function remove(row: Reminder) {
    const res = await supabase.from("reminders").delete().eq("id", row.id);
    if (res.error) {
      setLog((l) => [...l, `delete error: ${res.error.message}`]);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  function fmtTime(h: number, m: number) {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function truckName(id: string) {
    return trucks.find((t) => t.id === id)?.name ?? "Truck";
    }
  function templateName(id: string) {
    return templates.find((t) => t.id === id)?.name ?? "Template";
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Reminders</h1>
      <p className="text-[#6B7280]">
        Create daily auto-checklists for each truck/template at a local time. One reminder per
        truck/template pair.
      </p>

      {log.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">
            {log.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Create form */}
      <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="font-semibold">Create / Update Reminder</div>
        <div className="flex flex-wrap gap-2">
          <select
            className="border rounded-lg p-2 bg-white"
            value={truckId}
            onChange={(e) => setTruckId(e.target.value)}
          >
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            className="border rounded-lg p-2 bg-white"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <input
            className="border rounded-lg p-2 w-56"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            placeholder="Time zone, e.g. America/Los_Angeles"
          />
          <input
            type="number"
            min={0}
            max={23}
            className="border rounded-lg p-2 w-20"
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
          />
          <input
            type="number"
            min={0}
            max={59}
            className="border rounded-lg p-2 w-20"
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
          />
          <button
            className="rounded-2xl bg-[#004C97] text-white px-4 py-2 disabled:opacity-50"
            disabled={busy}
            onClick={createReminder}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="text-xs text-[#6B7280]">
          Example TZ values: <code>America/Los_Angeles</code>, <code>America/New_York</code>.
        </div>
      </section>

      {/* List */}
      <section className="bg-white rounded-2xl shadow-sm divide-y">
        {rows.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">
                {truckName(r.truck_id)} • {templateName(r.template_id)}
              </div>
              <div className="text-sm text-[#6B7280]">
                {r.tz} @ {fmtTime(r.hour_local, r.minute_local)} •{" "}
                {r.enabled ? "Enabled" : "Paused"}
                {r.last_run_on ? ` • Last run: ${r.last_run_on}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border px-3 py-2"
                onClick={() => toggle(r, !r.enabled)}
              >
                {r.enabled ? "Pause" : "Enable"}
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-[#DC3545] border-[#DC3545]"
                onClick={() => remove(r)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="p-4 text-[#6B7280]">No reminders yet.</div>
        )}
      </section>
    </main>
  );
}
