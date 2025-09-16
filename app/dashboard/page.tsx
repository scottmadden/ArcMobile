"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Run = { id: string; status: "open"|"submitted"; created_at: string; submitted_at: string | null };

export default function Dashboard() {
  const [log, setLog] = useState<string[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedCount7d, setFailedCount7d] = useState<number>(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLog([]);

      const since = new Date(); since.setDate(since.getDate() - 7);
      const startToday = new Date(); startToday.setHours(0,0,0,0);

      // Load runs (last 7 days)
      const { data, error } = await supabase
        .from("checklists")
        .select("id,status,created_at,submitted_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      if (error) setLog((l)=>[...l, `runs load error: ${error.message}`]);

      const list = (data || []) as Run[];
      setRuns(list);

      // Failed items in last 7 days (ok = false)
      // 1) collect run ids
      const ids = list.map(r => r.id);
      if (ids.length) {
        const { data: bad, error: badErr } = await supabase
          .from("responses")
          .select("id, ok, checklist_id")
          .in("checklist_id", ids)
          .eq("ok", false);
        if (badErr) setLog(l=>[...l, `failed items error: ${badErr.message}`]);
        setFailedCount7d((bad || []).length);
      } else {
        setFailedCount7d(0);
      }

      setLoading(false);
    })();
  }, []);

  const startToday = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  }, []);

  const kpis = useMemo(() => {
    const todayRuns = runs.filter(r => new Date(r.created_at) >= startToday);
    const todayCompleted = runs.filter(r => r.submitted_at && new Date(r.submitted_at) >= startToday);
    const overdueOpen = runs.filter(r => r.status === "open" && new Date(r.created_at) < startToday);

    const total7 = runs.length;
    const submitted7 = runs.filter(r => r.status === "submitted").length;
    const completion7 = total7 ? Math.round((submitted7 / total7) * 100) : 0;

    // avg time to complete (for submitted runs last 7d)
    const submitted = runs.filter(r => r.submitted_at);
    let avgMins = 0;
    if (submitted.length) {
      const mins = submitted.map(r => {
        const a = new Date(r.created_at).getTime();
        const b = new Date(r.submitted_at as string).getTime();
        return Math.max(0, (b - a) / 60000);
      });
      avgMins = Math.round(mins.reduce((s, m) => s + m, 0) / mins.length);
    }

    return {
      todayDue: todayRuns.length,
      todayCompleted: todayCompleted.length,
      overdueOpen: overdueOpen.length,
      completion7,
      failed7: failedCount7d,
      avgMins7: avgMins,
      total7,
    };
  }, [runs, startToday, failedCount7d]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <p className="text-muted">Mobile-first snapshot for your trucks.</p>

      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Due Today" value={String(kpis.todayDue)} />
        <Kpi label="Completed Today" value={String(kpis.todayCompleted)} />
        <Kpi label="Overdue (Open)" value={String(kpis.overdueOpen)} />
        <Kpi label="Completion (7d)" value={`${kpis.completion7}%`} sub={`${kpis.total7} runs`} />
        <Kpi label="Failed Items (7d)" value={String(kpis.failed7)} />
        <Kpi label="Avg Time to Complete" value={`${kpis.avgMins7} min`} />
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
        <div className="p-4 border-b font-semibold">Recent runs (7d)</div>
        {loading ? <div className="p-4">Loading…</div> :
          runs.slice(0,10).length === 0 ? <div className="p-4 text-muted">No activity yet.</div> :
          <ul>
            {runs.slice(0,10).map(r => (
              <li key={r.id} className="p-4 border-t flex items-center justify-between">
                <div>
                  <div className="font-medium capitalize">{r.status}</div>
                  <div className="text-sm text-muted">
                    {new Date(r.created_at).toLocaleString()}
                    {r.submitted_at && ` → ${new Date(r.submitted_at).toLocaleString()}`}
                  </div>
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
