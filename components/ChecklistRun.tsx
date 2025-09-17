// components/ChecklistRun.tsx
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function ChecklistRun({ orgId, template, templateItems, truckId, profileId }: any) {
  const qc = useQueryClient();
  const [responses, setResponses] = useState<{[key:string]: string}>({});
  const [notes, setNotes] = useState('');

  useEffect(()=> {
    // initialize defaults
    const init: any = {};
    (templateItems||[]).forEach((it:any) => init[it.id] = '');
    setResponses(init);
  }, [templateItems]);

  const submit = async () => {
    const payload = {
      org_id: orgId,
      truck_id: truckId,
      template_id: template.id,
      run_by: profileId,
      notes,
      responses: Object.entries(responses).map(([template_item_id, value]) => ({ template_item_id, value }))
    };
    const res = await fetch(`/api/checklists`, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' }});
    const j = await res.json();
    qc.invalidateQueries(['checklists', orgId]);
    // minimal UX: navigate or toast; simplified here
    alert('Checklist submitted');
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold">{template?.title}</h3>
      <div className="mt-3 space-y-3">
        {templateItems?.sort((a:any,b:any)=>a.sort_order-b.sort_order).map((it:any) => (
          <div key={it.id} className="bg-white p-3 rounded-xl shadow-sm">
            <div className="font-medium">{it.label}</div>
            {it.type === 'boolean' ? (
              <div className="flex gap-2 mt-2">
                <button className="btn" onClick={()=>setResponses({...responses, [it.id]:'yes'})}>Yes</button>
                <button className="btn" onClick={()=>setResponses({...responses, [it.id]:'no'})}>No</button>
              </div>
            ) : (
              <input value={responses[it.id]||''} onChange={e=>setResponses({...responses, [it.id]: e.target.value})} className="mt-2 rounded p-2 border w-full" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3">
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes" className="w-full p-3 rounded-xl border" />
      </div>
      <div className="mt-3">
        <button className="btn-primary w-full" onClick={submit}>Submit Checklist</button>
      </div>
    </div>
  );
}
