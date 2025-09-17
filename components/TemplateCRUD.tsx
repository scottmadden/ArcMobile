// components/TemplateCRUD.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function TemplateCRUD({ orgId, onSelect }: { orgId: string; onSelect?: (t:any)=>void }) {
  const qc = useQueryClient();
  const { data: templates } = useQuery({ queryKey: ['templates', orgId], queryFn: async () => {
    const res = await fetch(`/api/templates?orgId=${orgId}`);
    const json = await res.json();
    return json || [];
  });

  const createMutation = useMutation(async (payload:any) => {
    const res = await fetch('/api/templates', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    return res.json();
  }, { onSuccess: () => qc.invalidateQueries(['templates', orgId]) });

  const deleteMutation = useMutation(async (id:string) => {
    const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
    return res.json();
  }, { onSuccess: () => qc.invalidateQueries(['templates', orgId]) });

  const [title, setTitle] = useState('');

  useEffect(()=> {
    if (templates && templates.length && onSelect) onSelect(templates[0]);
  }, [templates]);

  return (
    <div className="p-2">
      <div className="flex gap-2">
        <input className="flex-1 rounded p-2 border" value={title} onChange={e=>setTitle(e.target.value)} placeholder="New template title" />
        <button className="btn-primary px-4" onClick={()=>{ if(!title) return alert('Title required'); createMutation.mutate({ org_id: orgId, title, created_by: null }); setTitle('');}}>Create</button>
      </div>

      <ul className="mt-3 space-y-2">
        {templates?.map((t:any) => (
          <li key={t.id} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
            <div>
              <div className="font-medium">{t.title}</div>
              <div className="text-sm text-muted">{t.description || ''}</div>
            </div>
            <div className="flex gap-2">
              {onSelect && <button className="text-sm px-2 py-1 rounded bg-slate-100" onClick={()=> onSelect(t)}>Select</button>}
              <button className="text-sm text-red-600" onClick={()=> deleteMutation.mutate(t.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
