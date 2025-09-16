"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Log = {
  id: string;
  org_id: string;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
};

export default function AuditPage() {
  const [rows, setRows] = useState<Log[]>([]);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, org_id, actor, action, entity, entity_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) setLog((l) => [...l, error.message]);
      setRows(data || []);
    })();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Audit Log</h1>
      <p className="text-[#6B7280] mt-1">Recent actions in your org.</p>

      {log.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl">
          <div className="font-semibold">Debug</div>
          <ul className="list-disc pl-6">{log.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl shadow-sm p-4">
            <div className="font-semibold capitalize">{r.action.replace("_", " ")}</div>
            <div className="text-sm text-[#6B7280]">
              {new Date(r.created_at).toLocaleString()} — {r.entity}
              {r.entity_id ? ` (${r.entity_id})` : ""} — actor: {r.actor ?? "—"}
            </div>
          </div>
        ))}
        {!rows.length && <div className="text-[#6B7280]">No audit entries yet.</div>}
      </div>
    </main>
  );
}
