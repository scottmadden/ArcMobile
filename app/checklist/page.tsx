"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Template = { id: string; name: string };
type Item = { id: string; text: string; sort_order: number };

export default function ChecklistPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("templates").select("id,name");
      setTemplates(t || []);
      if (t && t[0]) {
        const { data: i } = await supabase
          .from("items")
          .select("id,text,sort_order")
          .eq("template_id", t[0].id)
          .order("sort_order");
        setItems(i || []);
      }
    })();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Checklists</h1>
      <p className="text-muted mt-1">Demo template & items (read-only for now)</p>

      <div className="mt-4 space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl shadow-sm p-4">
            <div className="font-semibold">{t.name}</div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mt-6">Items</h2>
      <div className="mt-2 space-y-2">
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-3 bg-white p-3 rounded-xl">
            <input type="checkbox" disabled />
            <span>{it.text}</span>
          </label>
        ))}
      </div>
    </main>
  );
}
