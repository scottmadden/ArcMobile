"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Row = { id: string; created_at: string; status: string; truck: { name: string } | null };

export default function AssignmentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const u = await supabase.auth.getUser();
      if (!u.data.user) { setLog((l)=>[...l,"Not signed in"]); return; }
      const { data, error } = await supabase
        .from("checklists")
        .select("id, created_at, status, trucks:truck_id(name)")
        .eq("assigned_to", u.data.user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) setLog((l)=>[...l, error.message]);
      setRows((data || []).map(r => ({ id: r.id, created_at: r.created_at as string, status: r.status as string, truck: (r as any).trucks })));
    })();
  }, []);

  return (
    <main>
      <h1 className="text-xl font-bold">My Assignments</h1>
      <p className="text-[#6B7280] mt-1">Open checklists assigned to you.</p>

      {process.env.NEXT_PUBLIC_DEBUG === "true" && log.length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl">
          <div className="font-semibold">Debug</div>
          <ul className="list-disc pl-6">{log.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {rows.map(r => (
          <a key={r.id} href={`/checklist/${r.id}`} className="block bg-white rounded-2xl shadow-sm p-4">
            <div className="font-semibold">{r.truck?.name ?? "Truck"}</div>
            <div className="text-sm text-[#6B7280]">Started: {new Date(r.created_at).toLocaleString()}</div>
            <div className="text-sm text-[#6B7280]">Status: {r.status}</div>
          </a>
        ))}
        {!rows.length && <div className="text-[#6B7280]">No open assignments.</div>}
      </div>
    </main>
  );
}
