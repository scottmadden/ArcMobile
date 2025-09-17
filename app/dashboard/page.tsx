"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

// Keep this dynamic so Vercel doesn't try to prerender static HTML
export const dynamic = "force-dynamic";

type KPI = { label: string; value: string | number; hint?: string };

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Raw metric slots
  const [aToday, setAToday] = useState(0);
  const [openAssign, setOpenAssign] = useState(0);
  const [overdueRem, setOverdueRem] = useState(0);
  const [expiringPermits, setExpiringPermits] = useState(0);
  const [completionRate, setCompletionRate] = useState("0%");

  // ----- Dates -----
  const now = useMemo(() => new Date(), []);
  const startOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const endOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);
  const in30 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }, []);
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  // Small helper to attach org filter if we have one
  const withOrg = <T extends any>(q: T) => {
    return orgId ? (q as any).eq("org_id", orgId) : q;
  };

  // Format numbers nicely
  function fmt(n: number) {
    return new Intl.NumberFormat().format(n);
  }

  useEffect(() => {
    (async () => {
      try {
        // Who am I
        const { data: me, error: meErr } = await supabase.auth.getUser();
        if (meErr) setLog((l) => [...l, `auth error: ${meErr.message}`]);
        if (!me?.user) {
          setLog((l) => [...l, "Not signed in"]);
          // Root layout/AuthGate should redirect; we just stop loading
          setLoading(false);
          return;
        }

        // Load org (used to scope KPIs)
        const { data: mem, error: memErr } = await supabase
          .from("org_members")
          .select("org_id")
          .eq("user_id", me.user.id)
          .maybeSingle();

        if (memErr) setLog((l) => [...l, `org member error: ${memErr.message}`]);
        if (mem?.org_id) setOrgId(mem.org_id);

        // ---------- Collect KPIs in parallel ----------
        // >>> EDIT KPI QUERIES HERE (change table/column names if yours differ)
        const results = await Promise.allSettled([
          // 1) Assignments today (checklists created today and not submitted)
          withOrg(
            supabase
              .from("checklists")
              .select("id", { count: "exact", head: true })
              .gte("created_at", startOfDay.toISOString())
              .lte("created_at", endOfDay.toISOString())
              .neq("status", "submitted")
          ),

          // 2) Overdue reminders (due before today and not done)
          withOrg(
            supabase
              .from("reminders")
              .select("id", { count: "exact", head: true })
              .lt("due_at", startOfDay.toISOString())
              .neq("status", "done")
          ),

          // 3) Permits expiring in next 30 days
          withOrg(
            supabase
              .from("documents")
              .select("id", { count: "exact", head: true })
              .eq("doc_type", "permit")
              .gte("expires_at", now.toISOString())
              .lte("expires_at", in30.toISOString())
          ),

          // 4) Open assignments (not submitted)
          withOrg(
            supabase
              .from("checklists")
              .select("id", { count: "exact", head: true })
              .neq("status", "submitted")
          ),

          // 5a) Created in last 7d
          withOrg(
            supabase
              .from("checklists")
              .select("id", { count: "exact", head: true })
              .gte("created_at", weekAgo.toISOString())
          ),

          // 5b) Submitted in last 7d
          withOrg(
            supabase
              .from("checklists")
              .select("id", { count: "exact", head: true })
              .gte("submitted_at", weekAgo.toISOString())
              .not("submitted_at", "is", null)
          ),
        ]);
        // <<< END KPI QUERIES

        const getCount = (r: PromiseSettledResult<any>) =>
          r.status === "fulfilled" ? r.value?.count ?? 0 : 0;

        const _aToday = getCount(results[0]);
        const _overdueRem = getCount(results[1]);
        const _expiringPermits = getCount(results[2]);
        const _openAssign = getCount(results[3]);
        const _created7 = getCount(results[4]);
        const _submitted7 = getCount(results[5]);
        const rate =
          _created7 > 0 ? `${Math.round((_submitted7 / _created7) * 100)}%` : "0%";

        setAToday(_aToday);
        setOverdueRem(_overdueRem);
        setExpiringPermits(_expiringPermits);
        setOpenAssign(_openAssign);
        setCompletionRate(rate);
      } catch (e: any) {
        setLog((l) => [...l, `kpi error: ${e?.message || String(e)}`]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startOfDay.toISOString()]); // re-evaluate on new day

  // >>> EDIT KPI LABELS HERE (just change the text on the cards)
  const nextKPIs: KPI[] = [
    { label: "Assignments Today", value: fmt(aToday) },
    { label: "Open Assignments", value: fmt(openAssign) },
    { label: "Overdue Reminders", value: fmt(overdueRem) },
    { label: "Permits expiring (30d)", value: fmt(expiringPermits) },
    { label: "Completion (7d)", value: completionRate, hint: "submitted / created" },
  ];
  // <<< END KPI LABELS

  return (
    <main className="space-y-5 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <span className="text-sm text-[#6B7280]">
          {now.toLocaleDateString()} • {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {(log.length > 0 || orgId) && (
        <div className="rounded-2xl border p-3 text-sm">
          {orgId && <div className="mb-1 text-[#1F2937]">Org: <b>{orgId}</b></div>}
          {log.length > 0 && (
            <div className="text-red-700">
              <div className="font-semibold mb-1">Debug</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {log.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {nextKPIs.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl bg-white shadow-sm border p-4 flex flex-col justify-between min-h-[92px]"
          >
            <div className="text-[#6B7280] text-xs">{kpi.label}</div>
            <div className="text-2xl font-bold">{loading ? "—" : kpi.value}</div>
            {kpi.hint && <div className="text-[10px] text-[#9CA3AF] mt-1">{kpi.hint}</div>}
          </div>
        ))}
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-3">
        <a
          href="/assignments"
          className="rounded-2xl bg-[#004C97] text-white text-center py-3 font-medium"
        >
          View Assignments
        </a>
        <a
          href="/reminders"
          className="rounded-2xl bg-[#E6F0FA] text-[#004C97] text-center py-3 font-medium"
        >
          Reminders
        </a>
        <a
          href="/documents"
          className="rounded-2xl bg-white border text-center py-3 font-medium"
        >
          Documents
        </a>
        <a
          href="/analytics"
          className="rounded-2xl bg-white border text-center py-3 font-medium"
        >
          Analytics
        </a>
      </section>

      {/* Helpful note for you (safe to delete) */}
      <p className="text-xs text-[#9CA3AF]">
        To change what each KPI counts, edit the queries in <code>app/dashboard/page.tsx</code> at the
        <b> “EDIT KPI QUERIES HERE”</b> comment. To rename card titles, edit the <b>“EDIT KPI LABELS HERE”</b> block.
        If your tables are scoped by organization with a different column name, replace <code>org_id</code> in{" "}
        <code>withOrg()</code>.
      </p>
    </main>
  );
}
