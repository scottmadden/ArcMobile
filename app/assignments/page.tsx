"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  status: "open" | "submitted" | "canceled";
  created_at: string;
  assigned_to: string | null;
  truck_id: string;
  template_id: string;
  trucks?: { name: string } | { name: string }[] | null;
  templates?: { name: string } | { name: string }[] | null;
};

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <AssignmentsInner />
    </Suspense>
  );
}

function AssignmentsInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [mineOnly, setMineOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(true);

  const [me, setMe] = useState<{ id: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLog([]);

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLog(l=>[...l,"Not signed in"]); setLoading(false); return; }
      setMe({ id: u.user.id });

      // Pull recent runs (last 30 days should be plenty for MVP list)
      const since = new Date(); since.setDate(since.getDate() - 30);

      const { data, error } = await supabase
        .from("checklists")
        .select("id,status,created_at,assigned_to,truck_id,template_id,trucks(name),templates(name)")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      if (error) setLog(l=>[...l,`load error: ${error.message}`]);

      // normalize relation shapes (sometimes arrays)
      const norm: Row[] = ((data || []) as any[]).map(r => {
        const trucks = Array.isArray(r.trucks) ? (r.trucks[0] ?? null) : (r.trucks ?? null);
        const templates = Array.isArray(r.templates) ? (r.templates[0] ?? null) : (r.templates ?? null);
        return { ...r, trucks, templates };
      });

      setRows(norm);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (openOnly && r.status !== "open") return false;
      if (mineOnly && r.assigned_to !== me?.id) return false;
      return true;
    });
  }, [rows, mineOnly, openOnly, me?.id]);

  async function claim(row: Row) {
    if (!me?.id) return;
    const up = await supabase.from("checklists")
      .update({ assigned_to: me.id })
      .eq("id", row.id);
    if (up.error) { setLog(l=>[...l,`claim error: ${up.error.message}`]); return; }

    await supabase.from("audit_log").insert({
      action: "checklist_assigned",
      actor: me.id,
      meta: { checklist_id: row.id, to: me.id }
    });

    setRows(prev => prev.map(r => r.id === row.id ? { ...r, assigned_to: me.id } : r));
  }

  async function unassign(row: Row) {
    if (!me?.id) return;
    // Self-unassign only (MVP). Admin reassign can come later.
    if (row.assigned_to !== me.id) { setLog(l=>[...l,"You can only unassign yourself."]); return; }

    const up = await supabase.from("checklists")
      .update({ assigned_to: null })
      .eq("id", row.id);
    if (up.error) { setLog(l=>[...l,`unassign error: ${up.error.message}`]); return; }

    await supabase.from("audit_log").insert({
      action: "checklist_unassigned",
      actor: me.id,
      meta: { checklist_id: row.id, from: me.id }
    });

    setRows(prev => prev.map(r => r.id === row.id ? { ...r, assigned_to: null } : r));
  }

  function truckName(r: Row) { return (r.trucks as any)?.name ?? "Truck"; }
  function tplName(r: Row) { return (r.templates as any)?.name ?? "Template"; }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Assignments</h1>

      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <div className="flex gap-3 items-center">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mineOnly} onChange={e=>setMineOnly(e.target.checked)} />
          Mine
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={openOnly} onChange={e=>setOpenOnly(e.target.checked)} />
          Open only
        </label>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-[#6B7280]">No assignments.</div>
      ) : (
        <ul className="space-y-3">
          {filtered.map(r => {
            const assignedToMe = r.assigned_to && me?.id && r.assigned_to === me.id;
            const assigned = !!r.assigned_to;
            return (
              <li key={r.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{truckName(r)} • {tplName(r)}</div>
                    <div className="text-sm text-[#6B7280]">
                      {new Date(r.created_at).toLocaleString()} • {r.status}
                      {assigned ? (assignedToMe ? " • Assigned to you" : " • Assigned") : " • Unassigned"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      className="rounded-xl border px-3 py-2"
                      href={`/checklist?cid=${r.id}`}
                    >
                      Open
                    </a>
                    {r.status === "open" && (
                      assignedToMe ? (
                        <button className="rounded-xl border px-3 py-2" onClick={()=>unassign(r)}>
                          Unassign
                        </button>
                      ) : (
                        <button className="rounded-xl border px-3 py-2" onClick={()=>claim(r)}>
                          Assign to me
                        </button>
                      )
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
