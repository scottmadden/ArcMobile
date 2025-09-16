"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Item = { id: string; text: string; sort_order: number };
type Checklist = { id: string; template_id: string; truck_id: string; status: string };

type Photo = { id: string; file_path: string; created_at: string; url?: string };
type Sig   = { id: string; file_path: string; signed_at: string; url?: string };

export default function ChecklistRunPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const checklistId = params.id;

  const [items, setItems] = useState<Item[]>([]);
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sig, setSig] = useState<Sig | null>(null);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    (async () => {
      // Load checklist
      const { data: c, error: cErr } = await supabase
        .from("checklists")
        .select("id, template_id, truck_id, status")
        .eq("id", checklistId)
        .single();
      if (cErr) { setLog((l) => [...l, `checklist error: ${cErr.message}`]); setLoading(false); return; }
      setChecklist(c);

      // Items from template
      const { data: its, error: iErr } = await supabase
        .from("items")
        .select("id,text,sort_order")
        .eq("template_id", c.template_id)
        .order("sort_order");
      if (iErr) setLog((l) => [...l, `items error: ${iErr.message}`]);
      setItems(its || []);

      // Existing responses
      const { data: r, error: rErr } = await supabase
        .from("responses")
        .select("item_id,value")
        .eq("checklist_id", checklistId);
      if (rErr) setLog((l) => [...l, `responses error: ${rErr.message}`]);
      const v: Record<string, boolean> = {};
      (r || []).forEach((row) => { v[row.item_id] = !!row.value; });
      setValues(v);

      // Existing photos
      const { data: pRows, error: pErr } = await supabase
        .from("checklist_photos")
        .select("id, file_path, created_at")
        .eq("checklist_id", checklistId)
        .order("created_at", { ascending: false });
      if (pErr) setLog((l)=>[...l, `photos error: ${pErr.message}`]);
      const withPhotoUrls: Photo[] = await Promise.all(
        (pRows || []).map(async (row) => {
          const { data: link } = await supabase.storage.from("evidence").createSignedUrl(row.file_path, 120);
          return { ...row, url: link?.signedUrl };
        })
      );
      setPhotos(withPhotoUrls);

      // Latest signature
      const { data: sigRows, error: sErr } = await supabase
        .from("signatures")
        .select("id, file_path, signed_at")
        .eq("checklist_id", checklistId)
        .order("signed_at", { ascending: false })
        .limit(1);
      if (sErr) setLog((l)=>[...l, `signature error: ${sErr.message}`]);
      if (sigRows && sigRows[0]) {
        const { data: link } = await supabase.storage.from("evidence").createSignedUrl(sigRows[0].file_path, 120);
        setSig({ ...sigRows[0], url: link?.signedUrl });
      }

      setLoading(false);
    })();
  }, [checklistId]);

  function toggle(itemId: string) {
    setValues((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  async function addPhoto(file: File) {
    if (!checklist) return;
    const u = await supabase.auth.getUser();
    if (!u.data.user) { setLog((l)=>[...l, "Not signed in."]); return; }

    const path = `checklist-${checklist.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("evidence").upload(path, file, { upsert: true });
    if (upErr) { setLog((l)=>[...l, `evidence upload error: ${upErr.message}`]); return; }

    const { data: row, error: rowErr } = await supabase
      .from("checklist_photos")
      .insert({ checklist_id: checklist.id, file_path: path, uploaded_by: u.data.user.id })
      .select("id, file_path, created_at")
      .single();
    if (rowErr) { setLog((l)=>[...l, `photo row error: ${rowErr.message}`]); return; }

    const { data: link } = await supabase.storage.from("evidence").createSignedUrl(path, 120);
    setPhotos((prev)=> [{ ...row, url: link?.signedUrl }, ...prev ]);
  }

  // Signature canvas wiring
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.lineWidth = 2; ctx.lineCap = "round";
    const getPos = (e: any) => {
      const rect = c.getBoundingClientRect();
      if (e.touches && e.touches[0]) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const start = (e:any)=>{ drawing.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move  = (e:any)=>{ if (!drawing.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const end   = ()=>{ drawing.current = false; };
    c.onmousedown = start; c.onmousemove = move; c.onmouseup = end; c.onmouseleave = end;
    c.ontouchstart = start; c.ontouchmove = move; c.ontouchend = end; c.ontouchcancel = end;
  }, []);

  function clearSignature() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  }

  async function saveSignature() {
    if (!checklist) return;
    const c = canvasRef.current; if (!c) return;
    const blob: Blob = await new Promise((resolve) => c.toBlob((b)=>resolve(b as Blob), "image/png"));
    const path = `checklist-${checklist.id}/signature-${Date.now()}.png`;
    const { error: upErr } = await supabase.storage.from("evidence").upload(path, blob, { upsert: true });
    if (upErr) { setLog((l)=>[...l, `signature upload error: ${upErr.message}`]); return; }
    const u = await supabase.auth.getUser();
    await supabase.from("signatures").insert({
      checklist_id: checklist.id, file_path: path, signed_by: u.data.user?.id ?? null
    });
    const { data: link } = await supabase.storage.from("evidence").createSignedUrl(path, 120);
    setSig({ id: crypto.randomUUID(), file_path: path, signed_at: new Date().toISOString(), url: link?.signedUrl });
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

    // Audit with actor
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
      <p className="text-[#6B7280] mt-1">Tap to mark items, add photos & signature, then submit.</p>

      {process.env.NEXT_PUBLIC_DEBUG === "true" && log.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl">
          <div className="font-semibold">Debug</div>
          <ul className="list-disc pl-6">{log.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {/* Items */}
      <div className="mt-4 space-y-3">
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-3 bg-white p-4 rounded-2xl">
            <input type="checkbox" checked={!!values[it.id]} onChange={() => toggle(it.id)} />
            <span className="text-lg">{it.text}</span>
          </label>
        ))}
      </div>

      {/* Photo evidence */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm p-4">
        <div className="font-semibold">Photo Evidence</div>
        <input className="mt-2" type="file" accept="image/*" onChange={(e) => {
          const f = e.target.files?.[0]; if (f) addPhoto(f);
        }} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p)=> p.url ? (
            <a key={p.id} href={p.url} target="_blank" className="block">
              <img src={p.url} alt="evidence" className="w-full h-24 object-cover rounded-lg border" />
            </a>
          ) : null)}
        </div>
      </div>

      {/* Signature */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm p-4">
        <div className="font-semibold mb-2">Signature</div>
        <canvas ref={canvasRef} width={600} height={180} className="w-full border rounded-xl bg-[#F7F9FC]" />
        <div className="mt-2 flex gap-2">
          <button className="rounded-xl border px-3 py-2" onClick={clearSignature}>Clear</button>
          <button className="rounded-xl bg-[#004C97] text-white px-3 py-2" onClick={saveSignature}>Save Signature</button>
          {sig?.url && <a className="underline ml-auto" href={sig.url} target="_blank">View current</a>}
        </div>
      </div>

      <button
        className="mt-6 w-full rounded-2xl bg-[#004C97] text-white py-3"
        onClick={submit}
        disabled={loading}
      >
        {loading ? "Submitting…" : "Submit Checklist"}
      </button>
    </main>
  );
}
