"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Run = { id: string; status: "open"|"submitted"; created_at: string };

export default function Dashboard() {
  const [log, setLog] = useState<string[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [todayRuns, setTodayRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLog([]);
      const since = new Date(); since.setDate(since.getDate() - 7);

      const { data, error } = await supabase
        .from("checklists")
        .select("id,status,created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      if (error) setLog(l=>[...l, `runs load error: ${error.message}`]);
      const list = (data || []) as Run[];
      setRuns(list);

      const start = new Date(); start.setHours(0,0,0,0);
      setTodayRuns(list.filter(r => new Date(r.created_at) >= start));
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const total7 = runs.length;
    const submitted7 = runs.filter(r=>r.status === "submitted").length;
    const open7 = runs.filter(r=>r.status === "open").length;
    const completion7 = total7 ? Math.round((submitted7/total7)*100) : 0;

    const start = new Date(); start.setHours(0,0,0,0);
    const overdue = runs.filter(r=>r.status==="open" && new Date(r.created_at) < start).length;

    return { total7, submitted7, open7, completion7, overdue };
  }, [runs]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <p className="text-muted">Quick health of your operation (last 7 days).</p>

      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Completion (7d)" value={`${kpis.completion7}%`} sub={`${kpis.submitted7}/${kpis.total7}`} />
        <Kpi label="Open (7d)" value={String(kpis.open7)} />
        <Kpi label="Overdue" value={String(kpis.overdue)} />
        <Kpi label="Today’s runs" value={String(todayRuns.length)} />
      </section>

      <section className="card p-4 space-y-3">
        <div className="font-semibold">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href="/assignments">Open Assignments</a>
          <a className="btn-outline" href="/templates">Templates</a>
          <a className="btn-outline" href="/documents">Documents</a>
          <a className="btn-outline" href="/inspector-ready">Inspector Ready</a>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="p-4 border-b font-semibold">Recent runs</div>
        {loading ? <div className="p-4">Loading…</div> :
          runs.slice(0,10).length === 0 ? <div className="p-4 text-muted">No activity yet.</div> :
          <ul>
            {runs.slice(0,10).map(r => (
              <li key={r.id} className="p-4 border-t flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.status}</div>
                  <div className="text-sm text-muted">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <a className="btn-outline" href={`/checklist?cid=${r.id}`}>Open</a>
              </li>
            ))}
          </ul>
        }
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-muted text-sm">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
