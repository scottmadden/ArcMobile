"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Item = { id: string; text: string; sort_order: number };

// Force this route to be dynamic so Vercel doesn't try to prerender it statically
export const dynamic = "force-dynamic";

export default function ChecklistPage() {
  // Wrap the component that uses useSearchParams in Suspense (fixes Next.js build error)
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <ChecklistRunPageInner />
    </Suspense>
  );
}

function ChecklistRunPageInner() {
  const params = useSearchParams();
  const cid = params.get("cid"); // checklist id (required)

  const [log, setLog] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load the checklist run and its template items
  useEffect(() => {
    (async () => {
      try {
        if (!cid) {
          setLog((l) => [...l, "Missing checklist id (?cid=...)"]);
          return;
        }

        // 1) Load the checklist to get its template_id
        const { data: run, error: runErr } = await supabase
          .from("checklists")
          .select("id, template_id")
          .eq("id", cid)
          .maybeSingle();

        if (runErr) {
          setLog((l) => [...l, `load run error: ${runErr.message}`]);
          return;
        }
        if (!run || !run.template_id) {
          setLog((l) => [...l, "No template found for this checklist."]);
          return;
        }

        // 2) Load the template's items
        const { data: its, error: itemsErr } = await supabase
          .from("items")
          .select("id, text, sort_order")
          .eq("template_id", run.template_id)
          .order("sort_order", { ascending: true });

        if (itemsErr) {
          setLog((l) => [...l, `load items error: ${itemsErr.message}`]);
          return;
        }

        setItems(its || []);
        // Initialize all unchecked
        const init: Record<string, boolean> = {};
        (its || []).forEach((i) => (init[i.id] = false));
        setChecked(init);
      } finally {
        setLoading(false);
      }
    })();
  }, [cid]);

  const allDone = useMemo(
    () => items.length > 0 && items.every((i) => !!checked[i.id]),
    [items, checked]
  );

  function toggle(id: string, value: boolean) {
    setChecked((prev) => ({ ...prev, [id]: value }));
  }

  async function submit() {
    if (!cid || items.length === 0) return;
    setSubmitting(true);
    setNotice("");
    setLog([]);

    try {
      // Current user
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;

      // 1) Insert one response per item
      const rows = items.map((i) => ({
        checklist_id: cid,
        item_id: i.id,
        ok: !!checked[i.id],
        created_by: userId,
      }));
      // Upsert so re-submits or partial prior inserts don't fail on duplicates const ins = await supabase   .from("responses")   .upsert(rows, { onConflict: "checklist_id,item_id" }); // requires UPDATE policy
      if (ins.error) {
        setLog((l) => [...l, `responses error: ${ins.error.message}`]);
        return;
      }

      // 2) Mark checklist submitted
      const up = await supabase
        .from("checklists")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", cid);
      if (up.error) {
        setLog((l) => [...l, `submit error: ${up.error.message}`]);
        return;
      }

      // 3) Audit row with actor + quick stats
      await supabase.from("audit_log").insert({
        action: "checklist_submitted",
        actor: userId,
        meta: {
          checklist_id: cid,
          total_items: items.length,
          ok_count: rows.filter((r) => r.ok).length,
        },
      });

      setNotice("Checklist submitted.");
      // Return user to Assignments
      setTimeout(() => {
        window.location.href = "/assignments";
      }, 600);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Checklist</h1>

      {(notice || log.length > 0) && (
        <div
          className={`p-3 rounded-2xl ${
            log.length
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {notice && <div>{notice}</div>}
          {log.length > 0 && (
            <>
              <div className="font-semibold mb-1">Debug</div>
              <ul className="list-disc pl-6">
                {log.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <p className="text-[#6B7280]">Tap to mark items, then submit.</p>

      <div className="space-y-3">
        {items.map((i) => (
          <label
            key={i.id}
            className="flex items-center gap-3 bg-white rounded-2xl shadow-sm p-4"
          >
            <input
              type="checkbox"
              className="w-6 h-6"
              checked={!!checked[i.id]}
              onChange={(e) => toggle(i.id, e.target.checked)}
            />
            <span className="text-lg">{i.text}</span>
          </label>
        ))}
        {items.length === 0 && (
          <div className="text-[#6B7280]">No items loaded for this run.</div>
        )}
      </div>

      <button
        className="w-full rounded-2xl bg-[#004C97] text-white py-4 disabled:opacity-50"
        disabled={submitting || items.length === 0}
        onClick={submit}
      >
        {submitting
          ? "Submitting…"
          : `Submit Checklist${allDone ? "" : " (some items unchecked)"}`}
      </button>
    </main>
  );
}
