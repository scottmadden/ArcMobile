"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Item = { id: string; text: string; sort_order: number };
type Checklist = { id: string; template_id: string; truck_id: string; status: string };

type Photo = { id: string; file_path: string; created_at: string; url?: string };
type Sig   = { id: string; file_path: string; signed_at: string; url?: string };

// Safari-safe canvas -> Blob
async function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  if (c.toBlob) return await new Promise((res) => c.toBlob((b) => res(b as Blob), "image/png"));
  const dataUrl = c.toDataURL("image/png");
  const r = await fetch(dataUrl);
  return await r.blob();
}

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

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);

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

      const { data: pRows, error: pErr } = await supabase
        .from("checklist_photos")
        .select("id, file_path, created_at")
        .eq("checklist_id", checklistId)
        .order("created_at", { ascending: false });
      if (pErr) setLog((l)=>[...l, `photos error: ${pErr.message}`]);
      const photosWithUrls: Photo[] = await Promise.all(
        (pRows || []).map(async (row) => {
          const { data: link } = await supabase.storage.from("evidence").createSignedUrl(row.file_path, 120);
          return { ...row, url: link?.signedUrl };
        })
      );
      setPhotos(photosWithUrls);

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

  /** Signature pad: NO pointer-capture (Safari), HiDPI scaling, dot-on-tap **/
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;

    const resize = () => {
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const rect = c.getBoundingClientRect();
      c.width  = Math.max(1, Math.floor(rect.width * dpr));
      c.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = c.getContext("2d"); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);          // scale once for CSS pixels
      ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.strokeStyle = "#111827";
      ctxRef.current = ctx;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const getPos = (clientX: number, clientY: number) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startAt = (x: number, y: number) => {
    const ctx = ctxRef.current; if (!ctx) return;
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    // draw a tiny segment so a simple tap leaves a visible dot
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
  };

  const drawTo = (x: number, y: number) => {
    if (!drawing.current) return;
    const ctx = ctxRef.current; if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => { drawing.current = false; };

  // Pointer events (iOS Safari/Chrome support)
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const p = getPos(e.clientX, e.clientY);
    startAt(p.x, p.y);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = getPos(e.clientX, e.clientY);
    drawTo(p.x, p.y);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    endDraw();
  };

  // Fallback mouse/touch (older iOS)
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => onPointerDown(e as any);
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => onPointerMove(e as any);
  const onMouseUp   = (e: React.MouseEvent<HTMLCanvasElement>) => onPointerUp(e as any);
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const t = e.touches[0]; if (!t) return;
    onPointerDown({ ...e, clientX: t.clientX, clientY: t.clientY } as any);
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const t = e.touches[0]; if (!t) return;
    onPointerMove({ ...e, clientX: t.clientX, clientY: t.clientY } as any);
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    onPointerUp(e as any);
  };

  function clearSignature() {
    const c = canvasRef.current; const ctx = ctxRef.current; if (!c || !ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  }

  async function saveSignature() {
    if (!checklist) return;
    const c = canvasRef.current; if (!c) return;
    const blob = await canvasToBlob(c);
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
        <canvas
          ref={canvasRef}
          className="w-full h-40 border rounded-xl bg-[#F7F9FC]"
          style={{
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            WebkitTapHighlightColor: "transparent",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
        />
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
