"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Truck = { id: string; name: string; org_id: string };
type Template = { id: string; name: string; org_id: string };

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const [log, setLog] = useState<string[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [truck, setTruck] = useState<Truck | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLog([]);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLog(l=>[...l,"Not signed in"]); return; }

      const mem = await supabase.from("org_members")
        .select("org_id").eq("user_id", u.user.id).maybeSingle();
      if (mem.error) setLog(l=>[...l,`org member error: ${mem.error.message}`]);
      if (mem.data?.org_id) setOrgId(mem.data.org_id);

      const [tr, tp] = await Promise.all([
        supabase.from("trucks").select("id,name,org_id").order("created_at",{ascending:false}).limit(1).maybeSingle(),
        supabase.from("templates").select("id,name,org_id").order("created_at",{ascending:false}).limit(1).maybeSingle(),
      ]);
      if (tr.error) setLog(l=>[...l,`trucks load error: ${tr.error.message}`]);
      if (tp.error) setLog(l=>[...l,`templates load error: ${tp.error.message}`]);
      if (tr.data) setTruck(tr.data as Truck);
      if (tp.data) setTemplate(tp.data as Template);
    })();
  }, []);

  async function createTruck() {
    if (!orgId) { setLog(l=>[...l,"No org found"]); return; }
    setBusy(true);
    try {
      const ins = await supabase.from("trucks").insert({ name: "Demo Truck", org_id: orgId }).select("*").single();
      if (ins.error) { setLog(l=>[...l,`create truck error: ${ins.error.message}`]); return; }
      setTruck(ins.data as Truck);
    } finally { setBusy(false); }
  }

  async function createTemplate() {
    if (!orgId) { setLog(l=>[...l,"No org found"]); return; }
    setBusy(true);
    try {
      const t = await supabase.from("templates")
        .insert({ name: "Daily Truck Checklist", org_id: orgId })
        .select("*").single();
      if (t.error) { setLog(l=>[...l,`create template error: ${t.error.message}`]); return; }
      setTemplate(t.data as Template);

      // Seed 6 common items (idempotent-ish)
      const items = [
        "Wash hands before service",
        "Hold foods at safe temperatures",
        "Sanitize prep surfaces",
        "Check propane and generator",
        "Stock gloves and towels",
        "Trash removed and bins lined",
      ].map((text, i) => ({ template_id: t.data.id, text, sort_order: i+1 }));
      const insItems = await supabase.from("items").insert(items);
      if (insItems.error) setLog(l=>[...l,`seed items error: ${insItems.error.message}`]);
    } finally { setBusy(false); }
  }

  async function createTodayRun() {
    if (!truck || !template) { setLog(l=>[...l,"Need a truck and template first"]); return; }
    setBusy(true);
    try {
      // create an OPEN run for today if none exists
      const ins = await supabase.rpc("create_or_get_today_run", {
        p_truck_id: truck.id, p_template_id: template.id
      });
      // fallback if RPC not present
      if ((ins as any).error) {
        const up = await supabase.from("checklists").insert({
          truck_id: truck.id, template_id: template.id, status: "open"
        }).select("*").single();
        if (up.error && !up.error.message.includes("duplicate")) {
          setLog(l=>[...l,`create run error: ${up.error.message}`]);
          return;
        }
      }
      window.location.href = "/assignments";
    } finally { setBusy(false); }
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Setup</h1>
      <p className="text-[#6B7280]">Create a demo truck and a daily template with items. Use this once per org.</p>

      {log.length>0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl">
          <div className="font-semibold mb-1">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <div className="font-semibold">1) Truck</div>
        {truck ? (
          <div className="text-[#6B7280]">✔ {truck.name}</div>
        ) : (
          <button className="rounded-2xl bg-[#004C97] text-white px-4 py-2 disabled:opacity-50"
                  disabled={busy} onClick={createTruck}>
            {busy ? "Working…" : "Create Demo Truck"}
          </button>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <div className="font-semibold">2) Template + Items</div>
        {template ? (
          <div className="text-[#6B7280]">✔ {template.name}</div>
        ) : (
          <button className="rounded-2xl bg-[#004C97] text-white px-4 py-2 disabled:opacity-50"
                  disabled={busy || !truck} onClick={createTemplate}>
            {busy ? "Working…" : "Create Daily Template"}
          </button>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <div className="font-semibold">3) Create Today’s Run</div>
        <button className="rounded-2xl border px-4 py-2 disabled:opacity-50"
                disabled={busy || !truck || !template} onClick={createTodayRun}>
          {busy ? "Working…" : "Create/Open Today’s Run"}
        </button>
        <div className="text-xs text-[#6B7280]">You can also rely on the Reminders page to auto-create daily runs.</div>
      </section>
    </main>
  );
}
