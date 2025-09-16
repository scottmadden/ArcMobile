"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Truck = { id: string; name: string };
type Template = { id: string; name: string };
type Row = {
  id: string;
  truck_id: string;
  template_id: string;
  tz: string;
  hour_local: number;
  minute_local: number;
  enabled: boolean;
  last_run_on: string | null;
};

export const dynamic = "force-dynamic";

export default function RemindersPage() {
  const [log, setLog] = useState<string[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [truckId, setTruckId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [tz, setTz] = useState("America/Los_Angeles");
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLog(l=>[...l,"Not signed in"]); return; }

      const { data: mem, error: memErr } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (memErr) setLog(l=>[...l, `org member error: ${memErr.message}`]);
      if (mem?.org_id) setOrgId(mem.org_id);

      const [tr, tp, rm] = await Promise.all([
        supabase.from("trucks").select("id,name").order("name"),
        supabase.from("templates").select("id,name").order("name"),
        supabase.from("reminders").select("*").order("created_at", { ascending: false })
      ]);

      if (tr.error) setLog(l=>[...l,`trucks error: ${tr.error.message}`]);
      if (tp.error) setLog(l=>[...l,`templates error: ${tp.error.message}`]);
      if (rm.error) setLog(l=>[...l,`reminders load error: ${rm.error.message}`]);

      setTrucks(tr.data || []);
      setTemplates(tp.data || []);
      setRows((rm.data || []) as Row[]);

      if (tr.data?.[0]) setTruckId(tr.data[0].id);
      if (tp.data?.[0]) setTemplateId(tp.data[0].id);
    })();
  }, []);

  async function createReminder() {
    if (!truckId || !templateId) return;
    if (!orgId) { setLog(l=>[...l, "No org membership found; cannot create reminder."]); return; }
    setBusy(true);
    setLog([]);
    try {
      const { data: u } = await supabase.auth.getUser();
      const ins = await supabase.from("reminders").insert({
        org_id: orgId,                 // <— send org_id explicitly
        truck_id: truckId,
        template_id: templateId,
        tz,
        hour_local: hour,
        minute_local: minute,
        enabled: true,
        created_by: u.user?.id ?? null
      }).select("*").single();
      if (ins.error) { setLog(l=>[...l,`create error: ${ins.error.message}`]); return; }
      setRows(prev => [ins.data as Row, ...prev]);
    } finally { setBusy(false); }
  }

  async function toggle(row: Row, enabled: boolean) {
    const up = await supabase.from("reminders").update({ enabled }).eq("id", row.id).select("*").single();
    if (up.error) setLog(l=>[...l,`toggle error: ${up.error.message}`]);
    setRows(prev => prev.map(r => r.id === row.id ? (up.data as Row) : r));
  }

  function fmtTime(h: number, m: number) {
    const hh = String(h).padStart(2, "0"); const mm = String(m).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Reminders</h1>
      <p className="text-[#6B7280]">Create daily auto-checklists for each truck/template at a local time.</p>

      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="font-semibold">Create Reminder</div>
        <div className="flex flex-wrap gap-2">
          <select className="border rounded-lg p-2 bg-white" value={truckId} onChange={e=>setTruckId(e.target.value)}>
            {trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="border rounded-lg p-2 bg-white" value={templateId} onChange={e=>setTemplateId(e.target.value)}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input className="border rounded-lg p-2 w-44" value={tz} onChange={e=>setTz(e.target.value)} placeholder="Time zone, e.g. America/Los_Angeles" />
          <input type="number" min={0} max={23} className="border rounded-lg p-2 w-20" value={hour} onChange={e=>setHour(Number(e.target.value))} />
          <input type="number" min={0} max={59} className="border rounded-lg p-2 w-20" value={minute} onChange={e=>setMinute(Number(e.target.value))} />
          <button className="rounded-2xl bg-[#004C97] text-white px-4 py-2 disabled:opacity-50" disabled={busy} onClick={createReminder}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
        <div className="text-xs text-[#6B7280]">Example TZ values: America/Los_Angeles, America/New_York.</div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm divide-y">
        {rows.map(r => (
          <div key={r.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">Reminder</div>
              <div className="text-sm text-[#6B7280]">
                {r.tz} @ {fmtTime(r.hour_local, r.minute_local)} • {r.enabled ? "Enabled" : "Paused"}
                {r.last_run_on ? ` • Last run: ${r.last_run_on}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-xl border px-3 py-2" onClick={()=>toggle(r, !r.enabled)}>
                {r.enabled ? "Pause" : "Enable"}
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="p-4 text-[#6B7280]">No reminders yet.</div>}
      </section>
    </main>
  );
}
