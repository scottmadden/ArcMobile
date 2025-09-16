"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type LogRow = { id: string; action: string; meta: any; actor: string | null; created_at: string };
type Checklist = { id: string; truck_id: string; template_id: string | null };
type Truck = { id: string; name: string };
type Profile = { id: string; full_name: string | null };

export default function AuditPage() {
  const [log, setLog] = useState<string[]>([]);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [truckMap, setTruckMap] = useState<Map<string, string>>(new Map());
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<"all"|"checklist_submitted">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) { setLog(l=>[...l,"Not signed in"]); return; }

        // Pull recent 200 audit rows (RLS will scope to org via policy)
        const { data: logs, error: aErr } = await supabase
          .from("audit_log")
          .select("id, action, meta, actor, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        if (aErr) { setLog(l=>[...l, `audit load error: ${aErr.message}`]); return; }

        setRows(logs || []);

        // Collect checklist_ids -> fetch checklists -> trucks -> names
        const cids = Array.from(new Set((logs||[])
          .map(r => r.meta?.checklist_id)
          .filter((v: any) => !!v))) as string[];

        if (cids.length === 0) return;

        const { data: cks, error: cErr } = await supabase
          .from("checklists")
          .select("id, truck_id")
          .in("id", cids);
        if (cErr) setLog(l=>[...l, `checklists join error: ${cErr.message}`]);

        const truckIds = Array.from(new Set((cks||[]).map(c => c.truck_id)));

        const [{ data: trucks, error: tErr }, { data: profiles, error: pErr }] = await Promise.all([
          supabase.from("trucks").select("id, name").in("id", truckIds),
          supabase.from("profiles").select("id, full_name").in("id", (logs||[]).map(r => r.actor).filter(Boolean) as string[])
        ]);
        if (tErr) setLog(l=>[...l, `trucks join error: ${tErr.message}`]);
        if (pErr) setLog(l=>[...l, `profiles join error: ${pErr.message}`]);

        setTruckMap(new Map((trucks||[]).map((t: Truck)=>[t.id, t.name])));
        setNameMap(new Map((profiles||[]).map((p: Profile)=>[p.id, p.full_name || ""])));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return filter === "all" ? rows : rows.filter(r => r.action === filter);
  }, [rows, filter]);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Audit</h1>
      <p className="text-[#6B7280]">Recent activity across your fleet. (Most recent 200 rows)</p>

      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <div className="flex gap-2">
        <select className="border rounded-lg p-2 bg-white" value={filter} onChange={e=>setFilter(e.target.value as any)}>
          <option value="all">All events</option>
          <option value="checklist_submitted">Checklist submitted</option>
        </select>
      </div>

      <section className="bg-white rounded-2xl shadow-sm divide-y">
        {filtered.map((r) => {
          const cid = r.meta?.checklist_id as string | undefined;
          const truckName = cid && truckMap.get((r.meta?.truck_id as string) || "") // if included in meta
            || "";
          // Fallback: show truck after we hydrate (we didn't compute a map from cid->truck_id above; keep simple label)
          const who = (r.actor && nameMap.get(r.actor)) || "User";

        return (
          <div key={r.id} className="p-4 flex items-start justify-between">
            <div>
              <div className="font-medium">
                {r.action === "checklist_submitted" ? "Checklist submitted" : r.action}
              </div>
              <div className="text-sm text-[#6B7280]">
                {who} • {new Date(r.created_at).toLocaleString()}
              </div>
              {r.meta && (
                <div className="text-xs text-[#6B7280] mt-1">
                  {cid ? <>Checklist: <code>{cid}</code> • </> : null}
                  {typeof r.meta?.ok_count === "number" && typeof r.meta?.total_items === "number" ?
                    <>Passed {r.meta.ok_count}/{r.meta.total_items}</> : null}
                </div>
              )}
            </div>
          </div>
        );})}

        {filtered.length === 0 && (
          <div className="p-4 text-[#6B7280]">No audit records yet.</div>
        )}
      </section>
    </main>
  );
}
