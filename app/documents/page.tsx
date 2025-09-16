"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Doc = { id: string; name: string; file_path: string; uploaded_at: string };
type Truck = { id: string; name: string };
type DocWithLink = Doc & { url?: string };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocWithLink[]>([]);
  const [truck, setTruck] = useState<Truck | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data: trucks, error: trErr } = await supabase.from("trucks").select("id,name").limit(1);
    if (trErr) setLog((l) => [...l, `trucks error: ${trErr.message}`]);
    const tr = trucks?.[0] ?? null;
    setTruck(tr);

    const { data: d, error: dErr } = await supabase.from("documents").select("*").limit(20);
    if (dErr) setLog((l) => [...l, `documents error: ${dErr.message}`]);

    const withLinks: DocWithLink[] = await Promise.all(
      (d || []).map(async (row) => {
        const { data: link, error: linkErr } = await supabase.storage.from("documents").createSignedUrl(row.file_path, 60);
        if (linkErr) setLog((l) => [...l, `signed url error: ${linkErr.message}`]);
        return { ...row, url: link?.signedUrl };
      })
    );
    setDocs(withLinks);
  }

  useEffect(() => { load(); }, []);

  async function upload() {
    if (!file) return;
    if (!truck) { setLog((l) => [...l, "No truck found."]); return; }
    setLoading(true);

    const path = `truck-${truck.id}/${file.name}`;

    const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
    if (upErr) { setLog((l) => [...l, `storage upload error: ${upErr.message}`]); setLoading(false); return; }

    const { error: rowErr } = await supabase
      .from("documents")
      .upsert({ truck_id: truck.id, name: file.name, file_path: path }, { onConflict: "truck_id" });
    if (rowErr) { setLog((l) => [...l, `documents row error: ${rowErr.message}`]); setLoading(false); return; }

    // Audit: upload_permit with actor
    const u = await supabase.auth.getUser();
    const { data: trOrg } = await supabase.from("trucks").select("org_id").eq("id", truck.id).single();
    if (trOrg?.org_id && u.data.user) {
      await supabase.from("audit_log").insert({
        org_id: trOrg.org_id,
        actor: u.data.user.id,
        action: "upload_permit",
        entity: "documents",
        entity_id: null
      });
    }

    setFile(null);
    await load();
    setLoading(false);
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Documents</h1>
      <p className="text-muted mt-1">Upload your permit (one per truck in MVP). Files are private; links expire in 1 minute.</p>

      {log.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl">
          <div className="font-semibold">Debug</div>
          <ul className="list-disc pl-6">{log.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <div className="mt-4 bg-white rounded-2xl shadow-sm p-4">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button
          className="mt-3 w-full rounded-xl bg-[#004C97] text-white py-2"
          onClick={upload}
          disabled={loading || !file}
        >
          {loading ? "Uploading…" : (docs.length ? "Replace Permit" : "Upload Permit")}
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {docs.map((d) => (
          <div key={d.id} className="bg-white rounded-2xl shadow-sm p-4">
            <div className="font-semibold">{d.name}</div>
            <div className="text-sm text-[#6B7280]">Uploaded: {new Date(d.uploaded_at).toLocaleString()}</div>
            <div className="mt-2">
              {d.url ? <a href={d.url} target="_blank" className="underline">View permit (1-min link)</a> : <span className="text-sm text-[#6B7280]">No link</span>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
