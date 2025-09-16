"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <AnalyticsInner />
    </Suspense>
  );
}

type Row = { id: string; status: "open" | "submitted"; created_at: string };

function AnalyticsInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Pull last 14 days of checklists; RLS scopes these to the user's org.
        const start = new Date();
        start.setDate(start.getDate() - 14);

        const { data, error } = await supabase
          .from("checklists")
          .select("id,status,created_at")
          .gte("created_at", start.toISOString())
          .order("created_at", { ascending: false });

        if (error) {
          setLog((l) => [...l, `load error: ${error.message}`]);
          return;
        }
        setRows((data || []) as Row[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Compute metrics
  const { sevenDayPct, openOverdue, bucket } = useMemo(() => {
    const now = new Date();
    const sevenStart = new Date();
    sevenStart.setDate(now.getDate() - 7);

    const last7 = rows.filter((r) => new Date(r.created_at) >= sevenStart);
    const last7Total = last7.length;
    const last7Submitted = last7.filter((r) => r.status === "submitted").length;
    const sevenDayPct = last7Total ? Math.round((last7Submitted / last7Total) * 100) : 0;

    const openOverdue = rows.filter(
      (r) => r.status === "open" && new Date(r.created_at).getTime() < now.getTime() - 24 * 60 * 60 * 1000
    ).length;

    // Group per day for a tiny sparkline-like list
    const bucket = new Map<string, { total: number; submitted: number }>();
    rows.forEach((r) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      const cur = bucket.get(day) || { total: 0, submitted: 0 };
      cur.total += 1;
      if (r.status === "submitted") cur.submitted += 1;
      bucket.set(day, cur);
    });

    return { sevenDayPct, openOverdue, bucket };
  }, [rows]);

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Analytics</h1>
      <p className="text-[#6B7280]">Simple MVP metrics based on your recent checklists.</p>

      {log.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-sm text-[#6B7280]">7-day completion</div>
          <div className="text-3xl font-semibold mt-1">{sevenDayPct}%</div>
          <div className="text-xs text-[#6B7280] mt-1">Percent of runs submitted in the last 7 days.</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-sm text-[#6B7280]">Open & overdue</div>
          <div className="text-3xl font-semibold mt-1">{openOverdue}</div>
          <div className="text-xs text-[#6B7280] mt-1">Open runs older than 24 hours.</div>
        </div>
      </div>

      <section className="bg-white rounded-2xl shadow-sm p-4">
        <div className="font-medium mb-2">Daily trend (last 14 days)</div>
        <div className="space-y-2">
          {Array.from(bucket.entries())
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .slice(0, 14)
            .map(([day, { total, submitted }]) => {
              const pct = total ? Math.round((submitted / total) * 100) : 0;
              return (
                <div key={day} className="flex items-center justify-between text-sm">
                  <span className="text-[#6B7280]">{day}</span>
                  <span className="font-medium">{submitted}/{total} • {pct}%</span>
                </div>
              );
            })}
          {bucket.size === 0 && <div className="text-[#6B7280] text-sm">No recent data.</div>}
        </div>
      </section>
    </main>
  );
}
