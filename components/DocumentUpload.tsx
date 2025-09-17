// components/DocumentUpload.tsx
import React, { useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function DocumentUpload({ orgId, truckId, profileId }: any) {
  const fileRef = useRef<HTMLInputElement|null>(null);

  const upload = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return alert('Select a file');
    const path = `${orgId}/documents/${truckId || 'unassigned'}/${Date.now()}_${f.name}`;
    const { data, error } = await supabase.storage.from('documents').upload(path, f);
    if (error) return alert('Upload failed: '+error.message);
    // record in documents table via server API
    const { data: docRow } = await fetch('/api/documents', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({
      org_id: orgId, truck_id: truckId, storage_path: data.path, filename: f.name, uploaded_by: profileId
    })}).then(r=>r.json());
    alert('Uploaded');
  };

  return (
    <div className="p-3">
      <input ref={fileRef} type="file" />
      <div className="mt-2">
        <button className="btn-primary" onClick={upload}>Upload Document</button>
      </div>
    </div>
  );
}
