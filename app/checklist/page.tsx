"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Template = { id: string; name: string };
type Item = { id: string; text: string; sort_order: number };
type Truck = { id: string; name: string };

export default function ChecklistPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [truck, setTruck] = useState<Truck | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ completionPct: number; overdue: number }>({ completionPct: 0, overdue: 0 });
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: trucks, error: trErr } = await supabase.from("trucks").select("id,name").limit(1);
      if (trErr) setLog((l) => [...l, `trucks error: ${trErr.message}`]);
      setTruck(trucks?.[0] ?? null);

      const { data: t, error: tErr } = await supabase.from("templates").select("id,name");
      if (tErr) setLog((l) => [...l, `templates error: ${tErr.message}`]);
      setTemplates(t || []);

      if (t && t[0]) {
        const { data: i, error: iErr } = await supabase
          .from("items")
          .select("id,text,sort_order")
          .eq("template_id", t[0].id)
          .order("sort_order");
        if (iErr) setLog((l) => [...l, `items error: ${iErr.message}`]);
        setItems(i || []);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const total = await supabase.from("checklists").select("id", { count: "exact", head: true }).gte("created_at", since);
      const completed = await supabase
        .from("checklists")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .eq("status", "completed");
      const overdueOpen = await supabase
        .from("checklists")
        .select("id", { count: "exact", head: true })
        .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .eq("status", "open");

      const totalCount = total.count ?? 0;
      const completedCount = completed.count ?? 0;
      const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
      setStats({ completionPct: pct, overdue: overdueOpen.count ?? 0 });
    })();
  }, []);

  async function runChecklist(templateId: string) {
    try {
      if (!truck) { setLog((l) => [...l, "No truck found in your org."]); return; }
      setLoading(true);

      const u = await supabase.auth.getUser();
      if (!u.data.user) { setLog((l) => [...l, "Not signed in."]); return; }

      // Create checklist
      const { data, error } = await supabase
        .from("checklists")
        .insert({
          truck_id: truck.id,
          template_id: templateId,
          assigned_to: u.data.user.id,
          status: "open"
        })
        .select("id")
        .single();

      if (error || !data?.id) { setLog((l) => [...l, `create checklist error: ${error?.message || "unknown"}`]); return; }

      // Audit: start_checklist with actor
      const { data: tr } = await supabase.from("trucks").select("org_id").eq("id", truck.id).single();
      if (tr?.org_id) {
        await supabase.from("audit_log").insert({
          org_id: tr.org_id,
          actor: u.data.user.id,
          action: "start_checklist",
          entity: "checklists",
          entity_id: data.id
        });
      }

      router.push(`/checklist/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Checklists</h1>
      <p className="text-muted mt-1">Run a checklist for your truck.</p>

      {log.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl">
          <div className="font-semibold">Debug</div>
          <ul className="list-disc pl-6">{log.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {templates.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl shadow-sm p-4">
            <div className="font-semibold">{t.name}</div>
            <button
              onClick={() => runChecklist(t.id)}
              disabled={loading || !truck}
              className="mt-3 w-full rounded-xl bg-[#004C97] text-white py-2"
            >
              {loading ? "Starting..." : "Run Checklist"}
            </button>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mt-6">Items (preview)</h2>
      <div className="mt-2 space-y-2">
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-3 bg-white p-3 rounded-xl">
            <input type="checkbox" disabled />
            <span>{it.text}</span>
          </label>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-2xl shadow-sm p-4">
        <div className="font-semibold mb-2">Analytics (7 days)</div>
        <div className="flex gap-6 text-sm">
          <div>Completion %: <b>{stats.completionPct}%</b></div>
          <div>Overdue (open &gt;24h): <b>{stats.overdue}</b></div>
        </div>
      </div>
    </main>
  );
}
