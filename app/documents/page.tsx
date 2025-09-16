"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Truck = { id: string; name: string };
type DocRow = {
  id: string;
  truck_id: string;
  file_path: string;
  doc_type: string;
  created_at: string;
};

export default function DocumentsPage() {
  const [log, setLog] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [truckId, setTruckId] = useState<string>("");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Load org trucks and select the first one
  useEffect(() => {
    (async () => {
      try {
        const u = await supabase.auth.getUser();
        if (!u.data.user) {
          setLog((l) => [...l, "Not signed in"]);
          return;
        }

        const { data: member, error: memErr } = await supabase
          .from("org_members")
          .select("org_id")
          .eq("user_id", u.data.user.id)
          .maybeSingle();
        if (memErr) setLog((l) => [...l, `org member error: ${memErr.message}`]);
        const orgId = member?.org_id;
        if (!orgId) {
          setLog((l) => [...l, "No org membership"]);
          return;
        }

        const { data: tr, error: trErr } = await supabase
          .from("trucks")
          .select("id,name")
          .eq("org_id", orgId)
          .order("name");
        if (trErr) setLog((l) => [...l, `trucks error: ${trErr.message}`]);

        setTrucks(tr || []);
        if (tr && tr[0]) setTruckId(tr[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load docs for selected truck
  async function refreshList(id = truckId) {
    if (!id) return;
    const { data, error } = await supabase
      .from("docs")
      .select("id, truck_id, file_path, doc_type, created_at")
      .eq("truck_id", id)
      .order("created_at", { ascending: false });
    if (error) setLog((l) => [...l, `documents load error: ${error.message}`]);
    setDocs(data || []);
  }
  useEffect(() => {
    if (truckId) refreshList(truckId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truckId]);

  const truckName = useMemo(
    () => trucks.find((t) => t.id === truckId)?.name ?? "Truck",
    [trucks, truckId]
  );

  // Upload handler with accurate success count + clear errors
  async function uploadSelected() {
    const input = fileRef.current;
    if (!input || !input.files || !truckId) return;
    const files = Array.from(input.files);
    setBusy(true);
    setNotice("");
    setLog([]);

    let ok = 0;
    try {
      const u = await supabase.auth.getUser();
      if (!u.data.user) {
        setLog((l) => [...l, "Not signed in"]);
        return;
      }

      for (const file of files) {
        const path = `truck-${truckId}/${Date.now()}-${file.name}`;

        // Storage upload (requires storage.objects policy on bucket 'documents')
        const up = await supabase.storage.from("docs").upload(path, file, { upsert: true });
        if (up.error) {
          setLog((l) => [...l, `storage upload error: ${up.error.message}`]);
          continue;
        }

        // DB row insert (requires public.documents RLS)
        const ins = await supabase
          .from("docs")
          .insert({
            truck_id: truckId,
            file_path: path,
            doc_type: "permit",
            uploaded_by: u.data.user.id,
          })
          .select("id, truck_id, file_path, doc_type, created_at")
          .single();

        if (ins.error) {
          setLog((l) => [...l, `row insert error: ${ins.error.message}`]);
          continue;
        }

        ok += 1;
        setDocs((prev) => [ins.data!, ...prev]);
      }

      if (ok > 0) setNotice(`${ok} file(s) uploaded.`);
      input.value = ""; // clear chooser
    } finally {
      setBusy(false);
    }
  }

  async function viewDoc(row: DocRow) {
    const { data, error } = await supabase.storage.from("docs").createSignedUrl(row.file_path, 60);
    if (error || !data?.signedUrl) {
      setLog((l) => [...l, `signed url error: ${error?.message ?? "no url"}`]);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteDoc(row: DocRow) {
    if (!confirm("Delete this document?")) return;
    setBusy(true);
    try {
      const { error: del1 } = await supabase.storage.from("docs").remove([row.file_path]);
      if (del1) setLog((l) => [...l, `storage delete error: ${del1.message}`]);
      const { error: del2 } = await supabase.from("docs").delete().eq("id", row.id);
      if (del2) setLog((l) => [...l, `row delete error: ${del2.message}`]);
      setDocs((prev) => prev.filter((d) => d.id !== row.id));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Documents</h1>
      <p className="text-[#6B7280] mt-1">Upload, view, and delete documents for your trucks.</p>

      {/* Status messages */}
      {(notice || log.length > 0) && (
        <div
          className={`mt-3 p-3 rounded-2xl ${
            log.length
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {notice && <div>{notice}</div>}
          {log.length > 0 && (
            <ul className="list-disc pl-6">
              {log.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Truck picker + Refresh */}
      <div className="mt-4 flex items-center gap-2">
        <label className="text-sm text-[#6B7280]">Truck</label>
        <select
          className="border rounded-lg p-2 bg-white"
          value={truckId}
          onChange={(e) => setTruckId(e.target.value)}
        >
          {trucks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button className="rounded-xl border px-3 py-2" onClick={() => refreshList()}>
          Refresh
        </button>
      </div>

      {/* Upload controls */}
      <div className="mt-4 bg-white rounded-2xl shadow-sm p-4">
        <div className="font-semibold">Upload Documents</div>
        <div className="flex items-center gap-3 mt-2">
          <input ref={fileRef} type="file" multiple disabled={busy} />
          <button
            className="rounded-2xl bg-[#004C97] text-white px-4 py-2 disabled:opacity-50"
            disabled={busy}
            onClick={uploadSelected}
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
        <div className="text-xs text-[#6B7280] mt-1">
          Files are private; links expire after 60s.
        </div>
      </div>

      {/* Document list */}
      <div className="mt-4 space-y-2">
        {docs.map((d) => (
          <div
            key={d.id}
            className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3"
          >
            <div className="flex-1">
              <div className="font-medium">{d.doc_type}</div>
              <div className="text-sm text-[#6B7280]">
                {d.file_path.split("/").pop()}
              </div>
              <div className="text-xs text-[#6B7280]">
                Uploaded {new Date(d.created_at).toLocaleString()}
              </div>
            </div>
            <button
              className="rounded-xl border px-3 py-2"
              onClick={() => viewDoc(d)}
              disabled={busy}
            >
              View
            </button>
            <button
              className="rounded-xl bg-[#DC3545] text-white px-3 py-2"
              onClick={() => deleteDoc(d)}
              disabled={busy}
            >
              Delete
            </button>
          </div>
        ))}

        {docs.length === 0 && (
          <div className="text-[#6B7280]">No documents yet for {truckName}.</div>
        )}
      </div>
    </main>
  );
}
