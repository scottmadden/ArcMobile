"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Item = { id: string; text: string; sort_order: number };

export default function ChecklistRunPage() {
  const params = useSearchParams();
  const cid = params.get("cid"); // checklist id
  const [log, setLog] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!cid) { setLog(l=>[...l,"Missing checklist id (cid)"]); return; }
      // Load items for this checklist via its template
      const { data: run, error: runErr } = await supabase
        .from("checklists")
        .select("template_id")
        .eq("id", cid)
        .maybeSingle();
      if (runErr) { setLog(l=>[...l,`load run error: ${runErr.message}`]); return; }
      if (!run?.template_id) { setLog(l=>[...l,"No template found for checklist"]); return; }

      const { data: its, error: iErr } = await supabase
        .from("items")
        .select("id, text, sort_order")
        .eq("template_id", run.template_id)
        .order("sort_order", { ascending: true });
      if (iErr) { setLog(l=>[...l,`load items error: ${iErr.message}`]); return; }
      setItems(its || []);
    })();
  }, [cid]);

  const allDone = useMemo(() => items.length > 0 && items.every(i => checked[i.id]), [items, checked]);

  async function submit() {
    if (!cid) return;
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const rows = items.map(i => ({
        checklist_id: cid,
        item_id: i.id,
        ok: !!checked[i.id],
        created_by: u.user?.id ?? null,
      }));
      // Insert responses
      const ins = await supabase.from("responses").insert(rows);
      if (ins.error) { setLog(l=>[...l,`responses error: ${ins.error.message}`]); return; }

      // Mark checklist submitted + audit
      const up = await supabase.from("checklists").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", cid);
      if (up.error) { setLog(l=>[...l,`submit error: ${up.error.message}`]); return; }

      await supabase.from("audit_log").insert({
        action: "checklist_submitted",
        meta: { checklist_id: cid, total_items: items.length, ok_count: rows.filter(r=>r.ok).length }
      } as any);

      window.location.href = "/assignments";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Checklist</h1>
      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}
      <p className="text-[#6B7280]">Tap to mark items, then submit.</p>

      <div className="space-y-3">
        {items.map(i => (
          <label key={i.id} className="flex items-center gap-3 bg-white rounded-2xl shadow-sm p-4">
            <input
              type="checkbox"
              className="w-6 h-6"
              checked={!!checked[i.id]}
              onChange={e => setChecked(prev => ({ ...prev, [i.id]: e.target.checked }))}
            />
            <span className="text-lg">{i.text}</span>
          </label>
        ))}
        {items.length === 0 && <div className="text-[#6B7280]">No items loaded.</div>}
      </div>

      <button
        className="w-full rounded-2xl bg-[#004C97] text-white py-4 disabled:opacity-50"
        disabled={submitting || items.length === 0}
        onClick={submit}
      >
        {submitting ? "Submitting…" : `Submit Checklist${allDone ? "" : " (some items unchecked)"}`}
      </button>
    </main>
  );
}
