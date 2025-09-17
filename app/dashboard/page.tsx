"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type KPI = {
  label: string;
  value: number | string;
  hint?: string;
};

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: me } = await supabase.auth.getUser();
        if (!me.user) {
          window.location.replace("/login");
          return;
        }

        // org for scoping
        const { data: mem, error: memErr } = await supabase
          .from("org_members")
          .select("org_id")
          .eq("user_id", me.user.id)
          .maybeSingle();
        if (memErr) setLog((l)=>[...l, `org member error: ${memErr.message}`]);

        const orgId = mem?.org_id || null;

        // Time windows
        const now = new Date();
        const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(now);   endOfDay.setHours(23,59,59,999);

        const in30 = new Date(now); in30.setDate(now.getDate() + 30);
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);

        // Helpers
        const count = (rows: any[] | null | undefined) => Array.isArray(rows) ? rows.length : 0;

        // 1) Assignments today (checklists created today and not submitted)
        let assignmentsToday = 0;
        {
          const { data, error } = await supabase
            .from("checklists")
            .select("id, status, created_at")
            .gte("created_at", startOfDay.toISOString())
            .lte("created_at", endOfDay.toISOString())
            .neq("status", "submitted")
            .maybeSingle(); // use range? single will only fetch one - not correct
        }
      } catch {}
    })();
  }, []);

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {loading && <div className="text-gray-600">Loading KPIs…</div>}

      {!loading && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl bg-white shadow-sm p-4">
              <div className="text-sm text-gray-500">{k.label}</div>
              <div className="text-3xl font-semibold mt-1">{k.value}</div>
              {k.hint && <div className="text-xs text-gray-400 mt-1">{k.hint}</div>}
            </div>
          ))}
        </section>
      )}

      {log.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}
    </main>
  );
}
