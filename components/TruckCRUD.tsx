// components/TruckCRUD.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function TruckCRUD({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { data: trucks } = useQuery(['trucks', orgId], async () => {
    const { data } = await fetch(`/api/trucks?orgId=${orgId}`).then(r => r.json());
    return data || [];
  });

  const createMutation = useMutation(async (payload: any) => {
    const res = await fetch('/api/trucks', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type':'application/json' }});
    return res.json();
  }, { onSuccess: () => qc.invalidateQueries(['trucks', orgId]) });

  const deleteMutation = useMutation(async (id: string) => {
    const res = await fetch(`/api/trucks?id=${id}`, { method: 'DELETE' });
    return res.json();
  }, { onSuccess: () => qc.invalidateQueries(['trucks', orgId]) });

  const [name, setName] = useState('');
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold">Trucks</h3>
      <div className="flex gap-2 mt-2">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Truck name" className="rounded p-2 border w-full" />
        <button className="btn-primary px-4" onClick={() => { createMutation.mutate({ org_id: orgId, name }); setName(''); }}>Create</button>
      </div>
      <ul className="mt-4 space-y-2">
        {trucks?.map((t:any) => (
          <li key={t.id} className="p-3 bg-white rounded-xl shadow-sm flex justify-between items-center">
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-muted">{t.license_plate || ''}</div>
            </div>
            <div>
              <button className="text-sm text-red-600" onClick={() => deleteMutation.mutate(t.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
