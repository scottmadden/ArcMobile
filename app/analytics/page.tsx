"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Truck = { id: string; name: string };

type KPIs = {
  last7Total: number;
  last7Submitted: number;
  openNow: number;
  overdue: number;
  byTruck: Array<{ truck_id: string; name: string; submitted: number; open: number }>;
};

export default function AnalyticsPage() {
  const [log, setLog] = useState<string[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) { setLog((l)=>[...l,"Not signed in"]); return; }

        // Find org
        const { data: member, error: memErr } = await supabase
          .from("org_members")
          .select("org_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (memErr) setLog((l)=>[...l, `org member error: ${memErr.message}`]);
        const orgId = member?.org_id;
        if (!orgId) { setLog((l)=>[...l,"No org membership found"]); return; }

        // Load trucks map
        const { data: trucks, error: trErr } = await supabase
          .from("trucks")
          .select("id,name")
          .eq("org_id", orgId);
        if (trErr) setLog((l)=>[...l, `trucks error: ${trErr.message}`]);
        const tmap = new Map<string, string>((trucks||[]).map(t => [t.id, t.name]));

        // Time window
        const since = new Date();
        since.setDate(since.getDate() - 7);

        // Pull recent checklists for the org (7 days) and current open for simple KPIs
        const { data: recent, error: rErr } = await supabase
          .from("checklists")
          .select("id, status, created_at, truck_id")
          .gte("created_at", since.toISOString())
          .in("truck_id", (trucks||[]).map(t=>t.id));
        if (rErr) setLog((l)=>[...l, `recent checklists error: ${rErr.message}`]);

        const { data: openAll, error: oErr } = await supabase
          .from("checklists")
          .select("id, status, created_at, truck_id")
          .in("truck_id", (trucks||[]).map(t=>t.id))
          .neq("status", "submitted");
        if (oErr) setLog((l)=>[...l, `open checklists error: ${oErr.message}`]);

        // Compute KPIs
        const last7Total = recent?.length ?? 0;
        const last7Submitted = (recent||[]).filter(c => c.status === "submitted").length;

        const openNow = openAll?.length ?? 0;
        const overdueCutoff = new Date();
        overdueCutoff.setDate(overdueCutoff.getDate() - 1); // "overdue" = older than 1 day and not submitted
        const overdue = (openAll||[]).filter(c => new Date(c.created_at) < overdueCutoff).length;

        // Per-truck aggregates
        const agg = new Map<string, { submitted: number; open: number }>();
        (recent||[]).forEach(c => {
          const a = agg.get(c.truck_id) || { submitted: 0, open: 0 };
          if (c.status === "submitted") a.submitted += 1;
          else a.open += 1;
          agg.set(c.truck_id, a);
        });
        (openAll||[]).forEach(c => {
          // ensure trucks with only older open items are included
          const a = agg.get(c.truck_id) || { submitted: 0, open: 0 };
          if (c.status !== "submitted") a.open += 0; // already counted above
          agg.set(c.truck_id, a);
        });

        const byTruck = Array.from(agg.entries()).map(([truck_id, v]) => ({
          truck_id,
          name: tmap.get(truck_id) || "Truck",
          submitted: v.submitted,
          open: v.open,
        })).sort((a,b)=> (b.submitted+b.open) - (a.submitted+a.open));

        setKpis({ last7Total, last7Submitted, openNow, overdue, byTruck });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const completionRate = useMemo(() => {
    if (!kpis) return 0;
    return kpis.last7Total === 0 ? 0 : Math.round((kpis.last7Submitted / kpis.last7Total) * 100);
  }, [kpis]);

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Analytics</h1>
      <p className="text-[#6B7280]">Simple KPIs to start. Window: last 7 days.</p>

      {log.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Completion %" value={`${completionRate}%`} hint={`${kpis?.last7Submitted ?? 0} of ${kpis?.last7Total ?? 0}`} />
        <KpiCard label="Open Right Now" value={`${kpis?.openNow ?? 0}`} hint="status ≠ submitted" />
        <KpiCard label="Overdue (1+ day)" value={`${kpis?.overdue ?? 0}`} hint="open & >24h old" />
        <KpiCard label="Submitted (7d)" value={`${kpis?.last7Submitted ?? 0}`} hint="last 7 days" />
      </div>

      {/* Per-truck list */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <div className="font-semibold mb-2">By Truck (last 7 days)</div>
        <div className="divide-y">
          {(kpis?.byTruck ?? []).map(row => (
            <div key={row.truck_id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{row.name}</div>
                <div className="text-sm text-[#6B7280]">
                  Submitted: {row.submitted} • Open: {row.open}
                </div>
              </div>
              <div className="text-sm">
                <span className="px-3 py-1 rounded-xl bg-[#F7F9FC] border">
                  Total {row.submitted + row.open}
                </span>
              </div>
            </div>
          ))}
          {(kpis?.byTruck ?? []).length === 0 && (
            <div className="text-[#6B7280]">No checklist activity yet.</div>
          )}
        </div>
      </section>
    </main>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="text-sm text-[#6B7280]">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-[#6B7280] mt-1">{hint}</div>}
    </div>
  );
}
