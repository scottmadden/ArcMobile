"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Doc = { id: string; name: string; file_path: string; uploaded_at: string };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("documents").select("*").limit(20);
      setDocs(data || []);
    })();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Documents</h1>
      <p className="text-muted mt-1">Permit uploads will appear here.</p>

      <div className="mt-4 space-y-3">
        {docs.map((d) => (
          <div key={d.id} className="bg-white rounded-2xl shadow-sm p-4">
            <div className="font-semibold">{d.name}</div>
            <div className="text-sm text-muted">Path: {d.file_path}</div>
            <div className="text-sm text-muted">Uploaded: {new Date(d.uploaded_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
