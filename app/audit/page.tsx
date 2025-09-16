"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase"; // <- use relative path from app/audit/

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  actor: string | null;
  meta: any | null;
};

const ACTION_LABELS: Record<string, string> = {
  checklist_submitted: "Checklist submitted",
  doc_uploaded: "Document uploaded",
  reminder_created: "Reminder created",
  reminder_updated: "Reminder updated",
  reminder_deleted: "Reminder deleted",
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const { data: me } = await supabase.auth.getUser();
        if (!me.user) { setLog((l) => [...l, "Not signed in"]); return; }

        const { data: m, error: memErr } = await supabase
          .from("org_members").select("org_id").eq("user_id", me.user.id).maybeSingle();
        if (memErr) setLog((l) => [...l, `member error: ${memErr.message}`]);
        if (m?.org_id) setOrgId(m.org_id);

        const { data, error } = await supabase
          .from("audit_log")
          .select("id, created_at, action, actor, meta")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) setLog((l) => [...l, `load error: ${error.message}`]);
        setRows((data as any) || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () => rows.filter((r) => (actionFilter === "all" ? true : r.action === actionFilter)),
    [rows, actionFilter]
  );

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Audit</h1>

      {log.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <div className="flex gap-3 items-center">
        <label className="text-sm text-gray-600">Filter</label>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="border rounded-xl px-3 py-2"
        >
          <option value="all">All actions</option>
          <option value="checklist_submitted">{ACTION_LABELS["checklist_submitted"]}</option>
          <option value="doc_uploaded">{ACTION_LABELS["doc_uploaded"]}</option>
          <option value="reminder_created">{ACTION_LABELS["reminder_created"]}</option>
          <option value="reminder_updated">{ACTION_LABELS["reminder_updated"]}</option>
          <option value="reminder_deleted">{ACTION_LABELS["reminder_deleted"]}</option>
        </select>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-500">No audit entries yet.</div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <AuditCard key={r.id} row={r} orgId={orgId} />
          ))}
        </ul>
      )}
    </main>
  );
}

function AuditCard({ row, orgId }: { row: AuditRow; orgId: string }) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState<{ signature?: string | null; photos?: string[] }>({});
  const [loading, setLoading] = useState(false);
  const label = ACTION_LABELS[row.action] || row.action;

  async function loadEvidence() {
    if (!row.meta?.checklist_id || !orgId) return;
    setLoading(true);
    try {
      const sigPath = `org/${orgId}/checklists/${row.meta.checklist_id}/signature.png`;
      const sig = await supabase.storage.from("signatures").createSignedUrl(sigPath, 60);
      const signature = sig.data?.signedUrl || null;

      const prefix = `org/${orgId}/checklists/${row.meta.checklist_id}/photos`;
      const list = await supabase.storage.from("photos").list(prefix, { limit: 10 });
      const photos: string[] = [];
      if (list.data && list.data.length > 0) {
        for (const f of list.data) {
          const p = `${prefix}/${f.name}`;
          const u = await supabase.storage.from("photos").createSignedUrl(p, 60);
          if (u.data?.signedUrl) photos.push(u.data.signedUrl);
        }
      }
      setEvidence({ signature, photos });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && row.action === "checklist_submitted") loadEvidence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <li className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{label}</div>
          <div className="text-sm text-gray-600">
            {new Date(row.created_at).toLocaleString()}
            {row.actor ? ` • ${row.actor.slice(0, 8)}…` : ""}
          </div>
        </div>
        <button
          className="text-sm px-3 py-1.5 rounded-xl border hover:bg-gray-50"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Details"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <pre className="text-xs bg-gray-50 rounded-xl p-3 overflow-x-auto">
            {JSON.stringify(row.meta ?? {}, null, 2)}
          </pre>

          {row.action === "checklist_submitted" && (
            <Evidence orgId={orgId} checklistId={row.meta?.checklist_id} />
          )}
        </div>
      )}
    </li>
  );
}

function Evidence({ orgId, checklistId }: { orgId: string; checklistId: string }) {
  const [signature, setSignature] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const sigPath = `org/${orgId}/checklists/${checklistId}/signature.png`;
        const sig = await supabase.storage.from("signatures").createSignedUrl(sigPath, 60);
        if (sig.data?.signedUrl) setSignature(sig.data.signedUrl);

        const prefix = `org/${orgId}/checklists/${checklistId}/photos`;
        const list = await supabase.storage.from("photos").list(prefix, { limit: 10 });
        const urls: string[] = [];
        if (list.data) {
          for (const f of list.data) {
            const p = `${prefix}/${f.name}`;
            const u = await supabase.storage.from("photos").createSignedUrl(p, 60);
            if (u.data?.signedUrl) urls.push(u.data.signedUrl);
          }
        }
        setPhotos(urls);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, checklistId]);

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div className="space-y-2">
      <div className="font-medium">Evidence</div>
      {signature ? (
        <div>
          <div className="text-sm text-gray-600 mb-1">Signature</div>
          <img src={signature} alt="Signature" className="border rounded-xl max-w-xs" />
        </div>
      ) : (
        <div className="text-sm text-gray-500">No signature.</div>
      )}
      <div className="text-sm text-gray-600 mt-2">Photos</div>
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((u, i) => (
            <a key={i} href={u} target="_blank" className="block">
              <img src={u} alt={`Photo ${i + 1}`} className="border rounded-xl" />
            </a>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">No photos.</div>
      )}
    </div>
  );
}
