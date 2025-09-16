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
    const c = canvas
