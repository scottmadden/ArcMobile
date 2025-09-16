"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import SignaturePad from "../components/SignaturePad";

type Item = { id: string; text: string; sort_order: number };

export const dynamic = "force-dynamic";

export default function ChecklistPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <ChecklistRunPageInner />
    </Suspense>
  );
}

function ChecklistRunPageInner() {
  const params = useSearchParams();
  const cid = params.get("cid"); // checklist id

  const [log, setLog] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // photos + signature
  const [orgId, setOrgId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!cid) { setLog((l)=>[...l, "Missing checklist id (?cid=...)"]); return; }

        // Org id (for storage pathing)
        const { data: me } = await supabase.auth.getUser();
        if (!me.user) { setLog(l=>[...l,"Not signed in"]); return; }
        const { data: mem, error: memErr } = await supabase
          .from("org_members").select("org_id").eq("user_id", me.user.id).maybeSingle();
        if (memErr) setLog(l=>[...l, `org member error: ${memErr.message}`]);
        if (mem?.org_id) setOrgId(mem.org_id);

        // Load checklist -> template
        const { data: run, error: runErr } = await supabase
          .from("checklists").select("id, template_id").eq("id", cid).maybeSingle();
        if (runErr) { setLog(l=>[...l, `load run error: ${runErr.message}`]); return; }
        if (!run?.template_id) { setLog(l=>[...l, "No template found for this checklist."]); return; }

        // Load items
        const { data: its, error: itemsErr } = await supabase
          .from("items").select("id, text, sort_order")
          .eq("template_id", run.template_id)
          .order("sort_order", { ascending: true });
        if (itemsErr) { setLog(l=>[...l, `load items error: ${itemsErr.message}`]); return; }

        setItems(its || []);
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

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    setFiles(list.slice(0, 3)); // up to 3 photos
  }

  async function uploadSignature(userId: string | null) {
    if (!sigDataUrl || !cid || !orgId) return;
    const resp = await fetch(sigDataUrl);
    const blob = await resp.blob();
    const path = `org/${orgId}/checklists/${cid}/signature.png`;
    const up = await supabase.storage.from("signatures").upload(path, blob, {
      contentType: "image/png",
      upsert: true,
    });
    if (up.error) setLog((l)=>[...l, `signature upload error: ${up.error.message}`]);
  }

  async function uploadPhotos() {
    if (!files.length || !cid || !orgId) return;
    for (const f of files) {
      const ext = f.name.split(".").pop() || "jpg";
      const key = crypto.randomUUID();
      const path = `org/${orgId}/checklists/${cid}/photos/${key}.${ext}`;
      const up = await supabase.storage.from("photos").upload(path, f, {
        contentType: f.type || "image/jpeg",
        upsert: false
      });
      if (up.error) setLog((l)=>[...l, `photo upload error: ${up.error.message}`]);
    }
  }

  async function submit() {
    if (!cid || items.length === 0) return;
    setSubmitting(true);
    setNotice("");
    setLog([]);

    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;

      // Build responses
      const rows = items.map((i) => ({
        checklist_id: cid,
        item_id: i.id,
        ok: !!checked[i.id],
        created_by: userId,
      }));

      // Upsert to avoid dup constraint errors
      const ins = await supabase
        .from("responses")
        .upsert(rows, { onConflict: "checklist_id,item_id" });
      if (ins.error) { setLog((l)=>[...l, `responses error: ${ins.error.message}`]); return; }

      // Mark submitted
      const up = await supabase
        .from("checklists")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", cid);
      if (up.error) { setLog((l)=>[...l, `submit error: ${up.error.message}`]); return; }

      // Upload evidence (best-effort; do not block submit)
      try { await uploadSignature(userId); } catch {}
      try { await uploadPhotos(); } catch {}

      // Audit
      await supabase.from("audit_log").insert({
        action: "checklist_submitted",
        actor: userId,
        meta: {
          checklist_id: cid,
          total_items: items.length,
          ok_count: rows.filter((r) => r.ok).length,
          photos: files.length,
          signed: !!sigDataUrl
        },
      });

      setNotice("Checklist submitted.");
      setTimeout(() => { window.location.href = "/assignments"; }, 600);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Checklist</h1>

      {(notice || log.length > 0) && (
        <div className={`p-3 rounded-2xl ${log.length ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
          {notice && <div>{notice}</div>}
          {log.length > 0 && (
            <>
              <div className="font-semibold mb-1">Debug</div>
              <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
            </>
          )}
        </div>
      )}

      <p className="text-[#6B7280]">Tap to mark items, attach up to 3 photos, sign, then submit.</p>

      {/* Items */}
      <div className="space-y-3">
        {items.map((i) => (
          <label key={i.id} className="flex items-center gap-3 bg-white rounded-2xl shadow-sm p-4">
            <input
              type="checkbox"
              className="w-6 h-6"
              checked={!!checked[i.id]}
              onChange={(e) => toggle(i.id, e.target.checked)}
            />
            <span className="text-lg">{i.text}</span>
          </label>
        ))}
        {items.length === 0 && <div className="text-[#6B7280]">No items loaded for this run.</div>}
      </div>

      {/* Photos */}
      <section className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <div className="font-semibold">Photos (optional)</div>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={onFileChange}
          className="block"
        />
        <div className="text-xs text-[#6B7280]">Up to 3 images. Camera opens on mobile.</div>
        {files.length > 0 && <div className="text-sm">{files.length} selected</div>}
      </section>

      {/* Signature */}
      <section className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <div className="font-semibold">Signature (optional)</div>
        <SignaturePad onChange={setSigDataUrl} />
      </section>

      {/* Submit */}
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
