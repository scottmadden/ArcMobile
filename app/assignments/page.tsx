"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Truck = { id: string; name: string };
type Template = { id: string; name: string };
type Run = { id: string; truck_id: string; status: string; created_at: string; submitted_at: string | null; template_id: string };

export default function AssignmentsPage() {
  const [log, setLog] = useState<string[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [openRuns, setOpenRuns] = useState<Run[]>([]);
  const [truckId, setTruckId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const truckMap = useMemo(() => new Map(trucks.map(t => [t.id, t.name])), [trucks]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLog(l=>[...l,"Not signed in"]); return; }
      // org
      const { data: mem, error: memErr } = await supabase.from("org_members").select("org_id").eq("user_id", u.user.id).maybeSingle();
      if (memErr) setLog(l=>[...l,`org member error: ${memErr.message}`]);
      const orgId = mem?.org_id; if (!orgId) { setLog(l=>[...l,"No org membership"]); return; }

      // trucks + templates
      const [trRes, tpRes] = await Promise.all([
        supabase.from("trucks").select("id,name").eq("org_id", orgId).order("name"),
        supabase.from("templates").select("id,name").eq("org_id", orgId).order("name")
      ]);
      if (trRes.error) setLog(l=>[...l,`trucks error: ${trRes.error.message}`]);
      if (tpRes.error) setLog(l=>[...l,`templates error: ${tpRes.error.message}`]);
      setTrucks(trRes.data || []);
      setTemplates(tpRes.data || []);
      if (trRes.data?.[0]) setTruckId(trRes.data[0].id);
      if (tpRes.data?.[0]) setTemplateId(tpRes.data[0].id);

      // my open assignments
      const { data: runs, error: rErr } = await supabase
        .from("checklists")
        .select("id, truck_id, status, created_at, submitted_at, template_id")
        .eq("assigned_to", u.user.id)
        .neq("status", "submitted")
        .order("created_at", { ascending: true });
      if (rErr) setLog(l=>[...l,`assignments error: ${rErr.message}`]);
      setOpenRuns(runs || []);
    })();
  }, []);

  async function startRun() {
    if (!truckId || !templateId) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data, error } = await supabase
        .from("checklists")
        .insert({
          truck_id: truckId,
          template_id: templateId,
          status: "open",
          assigned_to: u.user.id,
          created_by: u.user.id
        })
        .select("id, truck_id, status, created_at, submitted_at, template_id")
        .single();
      if (error) { setLog(l=>[...l,`start error: ${error.message}`]); return; }
      // Navigate to the run
      window.location.href = `/checklist?cid=${data.id}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">My Assignments</h1>
      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {/* Start a new run */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <div className="font-semibold">Start a Checklist</div>
        <div className="mt-2 flex gap-2 flex-wrap">
          <select className="border rounded-lg p-2 bg-white" value={truckId} onChange={e=>setTruckId(e.target.value)}>
            {trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="border rounded-lg p-2 bg-white" value={templateId} onChange={e=>setTemplateId(e.target.value)}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="rounded-2xl bg-[#004C97] text-white px-4 py-2 disabled:opacity-50" disabled={busy} onClick={startRun}>
            {busy ? "Starting…" : "Start"}
          </button>
        </div>
      </section>

      {/* Open runs */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <div className="font-semibold mb-2">Open Checklists</div>
        <div className="divide-y">
          {openRuns.map(r => (
            <div key={r.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{truckMap.get(r.truck_id) ?? "Truck"}</div>
                <div className="text-sm text-[#6B7280]">Started {new Date(r.created_at).toLocaleString()}</div>
              </div>
              <Link href={`/checklist?cid=${r.id}`} className="rounded-xl border px-3 py-2">Open</Link>
            </div>
          ))}
          {openRuns.length === 0 && <div className="text-[#6B7280]">No open assignments.</div>}
        </div>
      </section>
    </main>
  );
}
