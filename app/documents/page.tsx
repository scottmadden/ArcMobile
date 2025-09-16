"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

type Truck = { id: string; name: string; org_id: string };
type DocRow = {
  id: string;
  truck_id: string;
  doc_type: string;
  storage_path: string;
  uploaded_at: string;
};

const DOC_TYPES = ["permit","license","inspection_report","insurance","misc"];

export default function DocumentsPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <DocumentsInner />
    </Suspense>
  );
}

function DocumentsInner() {
  const [log, setLog] = useState<string[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [busy, setBusy] = useState(false);

  // form
  const [truckId, setTruckId] = useState("");
  const [docType, setDocType] = useState("permit");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      setLog([]);
      // org
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLog(l=>[...l,"Not signed in"]); return; }

      const mem = await supabase.from("org_members")
        .select("org_id").eq("user_id", u.user.id).maybeSingle();
      if (mem.error) setLog(l=>[...l,`org member error: ${mem.error.message}`]);
      if (mem.data?.org_id) setOrgId(mem.data.org_id);

      // trucks & docs
      const [tr, dr] = await Promise.all([
        supabase.from("trucks").select("id,name,org_id").order("name"),
        supabase.from("documents").select("id,truck_id,doc_type,storage_path,uploaded_at").order("uploaded_at", { ascending: false })
      ]);
      if (tr.error) setLog(l=>[...l,`trucks error: ${tr.error.message}`]);
      if (dr.error) setLog(l=>[...l,`documents error: ${dr.error.message}`]);

      const trucksList = (tr.data || []) as Truck[];
      setTrucks(trucksList);
      setDocs((dr.data || []) as DocRow[]);
      if (trucksList[0]) setTruckId(trucksList[0].id);
    })();
  }, []);

  function truckName(id: string) {
    return trucks.find(t => t.id === id)?.name ?? "Truck";
  }

  async function upload() {
    if (!file || !truckId || !orgId) return;
    setBusy(true);
    setLog([]);

    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const key = crypto.randomUUID();
      const path = `org/${orgId}/trucks/${truckId}/${docType}/${key}.${ext}`;

      // 1) upload to storage (private)
      const up = await supabase.storage.from("documents").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });
      if (up.error) { setLog(l=>[...l,`storage upload error: ${up.error.message}`]); return; }

      // 2) upsert row (one per truck+type)
      const { data: u } = await supabase.auth.getUser();
      const ins = await supabase
        .from("documents")
        .upsert(
          { truck_id: truckId, doc_type: docType, storage_path: path, uploaded_by: u.user?.id ?? null },
          { onConflict: "truck_id,doc_type" }
        )
        .select("id,truck_id,doc_type,storage_path,uploaded_at")
        .single();
      if (ins.error) { setLog(l=>[...l,`row upsert error: ${ins.error.message}`]); return; }

      // 3) audit
      await supabase.from("audit_log").insert({
        action: "doc_uploaded",
        actor: u.user?.id ?? null,
        meta: { truck_id: truckId, doc_type: docType, filename: file.name }
      });

      // update list
      setDocs(prev => {
        const others = prev.filter(d => !(d.truck_id === truckId && d.doc_type === docType));
        return [ins.data as DocRow, ...others];
      });
      setFile(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: DocRow) {
    // delete DB row first (RLS by org)
    const del = await supabase.from("documents").delete().eq("id", row.id);
    if (del.error) { setLog(l=>[...l,`delete row error: ${del.error.message}`]); return; }

    // delete file (best-effort)
    const rm = await supabase.storage.from("documents").remove([row.storage_path]);
    if (rm.error) setLog(l=>[...l,`delete file error: ${rm.error.message}`]);

    setDocs(prev => prev.filter(d => d.id !== row.id));
  }

  async function signedUrl(path: string) {
    const s = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (s.error) { setLog(l=>[...l,`signed url error: ${s.error.message}`]); return "#"; }
    return s.data?.signedUrl ?? "#";
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Documents</h1>
      <p className="text-[#6B7280]">Upload and manage documents by truck and type. Files are private to your org.</p>

      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {/* Upload form */}
      <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="font-semibold">Upload / Replace</div>
        <div className="flex flex-wrap gap-2">
          <select className="border rounded-lg p-2" value={truckId} onChange={(e)=>setTruckId(e.target.value)}>
            {trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="border rounded-lg p-2" value={docType} onChange={(e)=>setDocType(e.target.value)}>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="file" className="border rounded-lg p-2" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
          <button
            className="rounded-2xl bg-[#004C97] text-white px-4 py-2 disabled:opacity-50"
            disabled={busy || !file || !truckId}
            onClick={upload}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="text-xs text-[#6B7280]">
          Re-upload with the same type to replace the existing file for that truck.
        </div>
      </section>

      {/* List */}
      <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b font-semibold">All Documents</div>
        {docs.length === 0 ? (
          <div className="p-4 text-[#6B7280]">No documents yet.</div>
        ) : (
          <ul>
            {docs.map((d) => (
              <li key={d.id} className="p-4 border-t flex items-center justify-between">
                <div>
                  <div className="font-medium">{truckName(d.truck_id)} • {d.doc_type}</div>
                  <div className="text-sm text-[#6B7280]">
                    Uploaded {new Date(d.uploaded_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    className="rounded-xl border px-3 py-2"
                    href="#"
                    onClick={async (e)=>{ e.preventDefault(); window.open(await signedUrl(d.storage_path), "_blank"); }}
                  >
                    View
                  </a>
                  <button className="rounded-xl border px-3 py-2 text-[#DC3545] border-[#DC3545]" onClick={()=>remove(d)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
