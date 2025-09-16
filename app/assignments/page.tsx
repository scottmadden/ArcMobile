"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { supabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

type NameObj = { name: string };
type Row = {
  id: string;
  status: "open" | "submitted";
  created_at: string;
  assigned_to: string | null;
  truck_id: string;
  template_id: string;
  trucks?: NameObj | null;     // normalized to single object
  templates?: NameObj | null;  // normalized to single object
};

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <AssignmentsInner />
    </Suspense>
  );
}

function AssignmentsInner() {
  const [log, setLog] = useState<string[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLog([]);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLog((l)=>[...l,"Not signed in"]); setLoading(false); return; }
      setUserId(u.user.id);

      // Last 14 days of OPEN checklists in your org; include related names
      const start = new Date();
      start.setDate(start.getDate() - 14);

      const { data, error } = await supabase
        .from("checklists")
        .select("id,status,created_at,assigned_to,truck_id,template_id,trucks(name),templates(name)")
        .eq("status","open")
        .gte("created_at", start.toISOString())
        .order("created_at",{ ascending: false });

      if (error) {
        setLog((l)=>[...l,`load error: ${error.message}`]);
      }

      // Normalize nested relations that can arrive as arrays -> single object or null
      const normalized: Row[] = ((data || []) as any[]).map((r: any) => {
        const trucks = Array.isArray(r.trucks) ? (r.trucks[0] ?? null) : (r.trucks ?? null);
        const templates = Array.isArray(r.templates) ? (r.templates[0] ?? null) : (r.templates ?? null);
        return { ...r, trucks, templates } as Row;
      });

      setRows(normalized);
      setLoading(false);
    })();
  }, []);

  const mine = useMemo(() => rows.filter(r => r.assigned_to === userId), [rows, userId]);
  const unassigned = useMemo(() => rows.filter(r => !r.assigned_to), [rows]);
  const others = useMemo(() => rows.filter(r => r.assigned_to && r.assigned_to !== userId), [rows, userId]);

  async function claim(row: Row) {
    const upd = await supabase.from("checklists")
      .update({ assigned_to: userId })
      .eq("id", row.id)
      .select("*").single();
    if (upd.error) { setLog(l=>[...l,`claim error: ${upd.error.message}`]); return; }
    setRows(prev => prev.map(r => r.id === row.id ? ({...r, assigned_to: userId}) : r));
  }

  async function unclaim(row: Row) {
    const upd = await supabase.from("checklists")
      .update({ assigned_to: null })
      .eq("id", row.id)
      .select("*").single();
    if (upd.error) { setLog(l=>[...l,`unclaim error: ${upd.error.message}`]); return; }
    setRows(prev => prev.map(r => r.id === row.id ? ({...r, assigned_to: null}) : r));
  }

  function openRun(row: Row) {
    // Checklist runner expects ?cid=
    window.location.href = `/checklist?cid=${row.id}`;
  }

  function CardList({ title, items, actions }:{
    title: string; items: Row[];
    actions: (r: Row)=>JSX.Element
  }) {
    return (
      <section className="bg-white rounded-2xl shadow-sm">
        <div className="p-4 border-b font-semibold">{title}</div>
        {items.length === 0 ? (
          <div className="p-4 text-[#6B7280]">None</div>
        ) : items.map(r => (
          <div key={r.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">
                {r.trucks?.name ?? "Truck"} • {r.templates?.name ?? "Template"}
              </div>
              <div className="text-sm text-[#6B7280]">
                Created {new Date(r.created_at).toLocaleString()}
                {r.assigned_to ? " • Assigned" : " • Unassigned"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {actions(r)}
              <button className="rounded-xl border px-3 py-2" onClick={()=>openRun(r)}>
                Open
              </button>
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Assignments</h1>
      <p className="text-[#6B7280]">Claim today’s open checklists, or jump straight in.</p>

      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <CardList
        title="My Open Assignments"
        items={mine}
        actions={(r)=>(<button className="rounded-xl border px-3 py-2" onClick={()=>unclaim(r)}>Unclaim</button>)}
      />
      <CardList
        title="Unassigned"
        items={unassigned}
        actions={(r)=>(<button className="rounded-xl border px-3 py-2" onClick={()=>claim(r)}>Claim</button>)}
      />
      <CardList
        title="Assigned to Others"
        items={others}
        actions={()=> (<span className="text-xs text-[#6B7280]">View only</span>)}
      />
    </main>
  );
}
