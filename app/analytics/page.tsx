"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  status: "open" | "submitted";
  created_at: string;
  truck_id: string;
  template_id: string;
  trucks?: { name: string } | { name: string }[] | null;
  templates?: { name: string } | { name: string }[] | null;
};

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <AnalyticsInner />
    </Suspense>
  );
}

function AnalyticsInner() {
  const [log, setLog] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLog([]);
      const start = new Date();
      start.setDate(start.getDate() - 7);

      const { data, error } = await supabase
        .from("checklists")
        .select("id,status,created_at,truck_id,template_id,trucks(name),templates(name)")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false });

      if (error) setLog((l)=>[...l,`load error: ${error.message}`]);

      // Normalize nested relation shapes (can appear as arrays)
      const norm: Row[] = ((data || []) as any[]).map(r => {
        const trucks = Array.isArray(r.trucks) ? (r.trucks[0] ?? null) : (r.trucks ?? null);
        const templates = Array.isArray(r.templates) ? (r.templates[0] ?? null) : (r.templates ?? null);
        return { ...r, trucks, templates };
      });

      setRows(norm);
      setLoading(false);
    })();
  }, []);

  // Helpers
  const startOfToday = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  }, []);

  const totals = useMemo(() => {
    const last7 = rows;
    const total = last7.length;
    const submitted7 = last7.filter(r => r.status === "submitted").length;
    const open7 = last7.filter(r => r.status === "open").length;

    const todayRows = rows.filter(r => new Date(r.created_at) >= startOfToday);
    const todaySubmitted = todayRows.filter(r => r.status === "submitted").length;
    const todayOpen = todayRows.filter(r => r.status === "open").length;

    // Overdue definition (MVP): any OPEN run created before today
    const overdue = rows.filter(r => r.status === "open" && new Date(r.created_at) < startOfToday).length;

    return {
      total7: total,
      submitted7,
      open7,
      completion7: total > 0 ? Math.round((submitted7 / total) * 100) : 0,
      todaySubmitted,
      todayOpen,
      overdue,
    };
  }, [rows, startOfToday]);

  // Per-truck table
  const perTruck = useMemo(() => {
    const map = new Map<string, { name: string; open: number; submitted: number }>();
    for (const r of rows) {
      const key = r.truck_id;
      const name = (r.trucks as any)?.name ?? "Truck";
      if (!map.has(key)) map.set(key, { name, open: 0, submitted: 0 });
      const rec = map.get(key)!;
      if (r.status === "open") rec.open += 1; else rec.submitted += 1;
    }
    return Array.from(map.values()).sort((a,b)=> (b.open+b.submitted) - (a.open+a.submitted));
  }, [rows]);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Analytics</h1>
      <p className="text-[#6B7280]">Simple health metrics for the last 7 days. Overdue means an open run created before today.</p>

      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {/* KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Completion (7d)" value={`${totals.completion7}%`} sub={`${totals.submitted7}/${totals.total7}`} />
        <Kpi label="Open (7d)" value={String(totals.open7)} />
        <Kpi label="Overdue (open before today)" value={String(totals.overdue)} />
        <Kpi label="Submitted (today)" value={String(totals.todaySubmitted)} />
        <Kpi label="Open (today)" value={String(totals.todayOpen)} />
      </section>

      {/* Per-truck */}
      <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b font-semibold">Per Truck (last 7 days)</div>
        {perTruck.length === 0 ? (
          <div className="p-4 text-[#6B7280]">No activity yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F7F9FC] text-[#6B7280]">
              <tr>
                <th className="text-left p-3 font-medium">Truck</th>
                <th className="text-right p-3 font-medium">Submitted</th>
                <th className="text-right p-3 font-medium">Open</th>
                <th className="text-right p-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {perTruck.map((t, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3">{t.name}</td>
                  <td className="p-3 text-right">{t.submitted}</td>
                  <td className="p-3 text-right">{t.open}</td>
                  <td className="p-3 text-right">{t.open + t.submitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="text-[#6B7280] text-sm">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-[#6B7280] mt-1">{sub}</div>}
    </div>
  );
}
