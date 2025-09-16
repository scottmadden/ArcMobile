"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Item = { id: string; text: string; sort_order: number };
type Checklist = { id: string; template_id: string; truck_id: string; status: string };

export default function ChecklistRunPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const checklistId = params.id;

  const [items, setItems] = useState<Item[]>([]);
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<Checklist | null>(null);

  useEffect(() => {
    (async () => {
      const { data: c, error: cErr } = await supabase
        .from("checklists")
        .select("id, template_id, truck_id, status")
        .eq("id", checklistId)
        .single();
      if (cErr) { setLog((l) => [...l, `checklist error: ${cErr.message}`]); setLoading(false); return; }
      setChecklist(c);

      const { data: its, error: iErr } = await supabase
        .from("items")
        .select("id,text,sort_order")
        .eq("template_id", c.template_id)
        .order("sort_order");
      if (iErr) setLog((l) => [...l, `items error: ${iErr.message}`]);
      setItems(its || []);

      const { data: r, error: rErr } = await supabase
        .from("responses")
        .select("item_id,value")
        .eq("checklist_id", checklistId);
      if (rErr) setLog((l) => [...l, `responses error: ${rErr.message}`]);
      const v: Record<string, boolean> = {};
      (r || []).forEach((row) => { v[row.item_id] = !!row.value; });
      setValues(v);

      setLoading(false);
    })();
  }, [checklistId]);

  function toggle(itemId: string) {
    setValues((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  async function submit() {
    if (!checklist) return;
    setLoading(true);

    const payload = items.map((it) => ({
      checklist_id: checklist.id,
      item_id: it.id,
      value: !!values[it.id],
    }));

    const { error: upErr } = await supabase.from("responses").upsert(payload, { onConflict: "checklist_id,item_id" });
    if (upErr) { setLog((l) => [...l, `save responses error: ${upErr.message}`]); setLoading(false); return; }

    const { error: upC } = await supabase
      .from("checklists")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", checklist.id);
    if (upC) { setLog((l) => [...l, `complete error: ${upC.message}`]); setLoading(false); return; }

    // Audit: complete_checklist with actor
    const u = await supabase.auth.getUser();
    const { data: truckRow } = await supabase.from("trucks").select("org_id").eq("id", checklist.truck_id).single();
    if (truckRow?.org_id && u.data.user) {
      await supabase.from("audit_log").insert({
        org_id: truckRow.org_id,
        actor: u.data.user.id,
        action: "complete_checklist",
        entity: "checklists",
        entity_id: checklist.id
      });
    }

    setLoading(false);
    router.push("/checklist");
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Checklist</h1>
      <p className="text-muted mt-1">Tap to mark items, then submit.</p>

      {log.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl">
          <div className="font-semibold">Debug</div>
          <ul className="list-disc pl-6">{log.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-3 bg-white p-3 rounded-xl">
            <input type="checkbox" checked={!!values[it.id]} onChange={() => toggle(it.id)} />
            <span>{it.text}</span>
          </label>
        ))}
      </div>

      <button
        className="mt-6 w-full rounded-xl bg-[#004C97] text-white py-3"
        onClick={submit}
        disabled={loading}
      >
        {loading ? "Submitting…" : "Submit Checklist"}
      </button>
    </main>
  );
}
