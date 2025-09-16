"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Truck = { id: string; name: string };
type Checklist = {
  id: string;
  truck_id: string;
  status: "open" | "completed";
  created_at: string;
  completed_at: string | null;
};

const fmt = (n: number) => new Intl.NumberFormat().format(n);
const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((num / den) * 100));

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [rows, setRows] = useState<Checklist[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // Determine the user's org (assume single org membership for MVP)
        const u = await supabase.auth.getUser();
        if (!u.data.user) { setLog((l)=>[...l, "Not signed in."]); setLoading(false); return; }

        const { data: member, error: memErr } = await supabase
          .from("org_members")
          .select("org_id")
          .eq("user_id", u.data.user.id)
          .limit(1)
          .maybeSingle();

        if (memErr) setLog((l)=>[...l, `org membership error: ${memErr.message}`]);
        const orgId = member?.org_id;
        if (!orgId) { setLog((l)=>[...l, "No org membership found."]); setLoading(false); return; }

        // Trucks in org
        const { data: tr, error: trErr } = await supabase
          .from("trucks")
          .select("id,name")
          .eq("org_id", orgId)
          .order("name");
        if (trErr) setLog((l)=>[...l, `trucks error: ${trErr.message}`]);
        setTrucks(tr || []);

        // Last 14 days of checklists for these trucks
        const since = new Date(); since.setDate(since.getDate() - 14);
        const truckIds = (tr || []).map(t => t.id);
        if (truckIds.length === 0) { setLoading(false); return; }

        const { data: cls, error: clErr } = await supabase
          .from("checklists")
          .select("id,truck_id,status,created_at,completed_at")
          .in("truck_id", truckIds)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false });
        if (clErr) setLog((l)=>[...l, `checklists error: ${clErr.message}`]);

        setRows(cls || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Derived metrics
  const now = new Date();
  const sevenDaysAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; }, []);
  const oneDayAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; }, []);

  const last7 = rows.filter(r => new Date(r.created_at) >= sevenDaysAgo);
  const last7Completed = last7.filter(r => r.status === "completed");
  const completionPercent7d = pct(last7Completed.length, last7.length);

  const overdueOpen = rows.filter(r => r.status === "open" && new Date(r.created_at) < oneDayAgo);

  // Per-truck metrics (last 7 days)
  const perTruck = useMemo(() => {
    const map: Record<string, { name: string; total: number; done: number }> = {};
    for (const t of trucks) map[t.id] = { name: t.name, total: 0, done: 0 };
    for (const r of last7) {
      const t = map[r.truck_id]; if (!t) continue;
      t.total += 1;
      if (r.status === "completed") t.done += 1;
    }
    return Object.entries(map).map(([truck_id, v]) => ({ truck_id, ...v, pct: pct(v.done, v.total) }))
      .sort((a,b)=> b.pct - a.pct);
  }, [trucks, last7]);

  // Simple 7-day timeline (counts per day)
  const daily = useMemo(() => {
    const days: { date: string; total: number; done: number }[] = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const total = rows.filter(r => new Date(r.created_at).toISOString().slice(0,10) === key).length;
      const done = rows.filter(r => r.status==="completed" && r.completed_at && new Date(r.completed_at).toISOString().slice(0,10) === key).length;
      days.push({ date: key, total, done });
    }
    return days;
  }, [rows]);

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Analytics</h1>
      <p className="text-[#6B7280] mt-1">Last 7–14 days overview for your org.</p>

      {process.env.NEXT_PUBLIC_DEBUG === "true" && log.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl">
          <div className="font-semibold">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {/* KPI cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-sm text-[#6B7280]">Completion (7d)</div>
          <div className="text-2xl font-bold mt-1">{completionPercent7d}%</div>
          <div className="text-xs text-[#6B7280]">{fmt(last7Completed.length)} / {fmt(last7.length)} runs</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-sm text-[#6B7280]">Overdue (&gt;24h open)</div>
          <div className="text-2xl font-bold mt-1">{fmt(overdueOpen.length)}</div>
          <div className="text-xs text-[#6B7280]">Needs attention</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-sm text-[#6B7280]">Runs (7d)</div>
          <div className="text-2xl font-bold mt-1">{fmt(last7.length)}</div>
          <div className="text-xs text-[#6B7280]">{fmt(last7Completed.length)} completed</div>
        </div>
      </div>

      {/* 7-day mini bars */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm p-4">
        <div className="font-semibold mb-2">Last 7 Days</div>
        <div className="grid grid-cols-7 gap-2 items-end">
          {daily.map(d => {
            const max = Math.max(1, ...daily.map(x => x.total));
            const hTotal = (d.total / max) * 80;   // px
            const hDone  = (d.done  / max) * 80;   // px
            return (
              <div key={d.date} className="flex flex-col items-center">
                <div className="relative w-4 h-20 bg-[#E5E7EB] rounded">
                  <div className="absolute bottom-0 left-0 right-0 mx-auto w-4 rounded" style={{ height: `${hTotal}px`, background: "#CBD5E1" }} />
                  <div className="absolute bottom-0 left-0 right-0 mx-auto w-4 rounded" style={{ height: `${hDone}px`,  background: "#004C97" }} />
                </div>
                <div className="text-[10px] mt-1">{d.date.slice(5)}</div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-xs text-[#6B7280] mt-2">
          <span className="inline-block w-3 h-3 rounded" style={{ background: "#004C97" }}></span> Completed
          <span className="inline-block w-3 h-3 rounded" style={{ background: "#CBD5E1" }}></span> Total
        </div>
      </div>

      {/* Per-truck table */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm p-4">
        <div className="font-semibold mb-2">Per-Truck Completion (7d)</div>
        <div className="space-y-2">
          {perTruck.map(t => (
            <div key={t.truck_id} className="p-3 rounded-xl border">
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.name || "Truck"}</div>
                <div className="text-sm text-[#6B7280]">{t.done}/{t.total} ({t.pct}%)</div>
              </div>
              <div className="h-2 bg-[#E5E7EB] rounded mt-2">
                <div className="h-2 rounded" style={{ width: `${t.pct}%`, background: "#28A745" }} />
              </div>
            </div>
          ))}
          {perTruck.length === 0 && <div className="text-[#6B7280]">No runs in the last week.</div>}
        </div>
      </div>

      {/* Overdue list */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm p-4">
        <div className="font-semibold mb-2">Overdue Checklists (&gt;24h open)</div>
        <div className="space-y-2">
          {overdueOpen.map(o => {
            const truck = trucks.find(t => t.id === o.truck_id);
            return (
              <a key={o.id} href={`/checklist/${o.id}`} className="block p-3 rounded-xl border hover:bg-[#F7F9FC]">
                <div className="font-medium">{truck?.name ?? "Truck"}</div>
                <div className="text-sm text-[#6B7280]">Started {new Date(o.created_at).toLocaleString()}</div>
              </a>
            );
          })}
          {overdueOpen.length === 0 && <div className="text-[#6B7280]">No overdue runs 🎉</div>}
        </div>
      </div>
    </main>
  );
}
