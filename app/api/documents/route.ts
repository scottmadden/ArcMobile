// app/api/documents/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(URL, SR);

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId');
  const truckId = req.nextUrl.searchParams.get('truckId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  let q = sb.from('documents').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
  if (truckId) q = q.eq('truck_id', truckId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  // record an already-uploaded file's metadata into documents table
  const body = await req.json();
  const { org_id, truck_id, storage_path, filename, uploaded_by } = body;
  if (!org_id || !storage_path || !filename) return NextResponse.json({ error: 'org_id, storage_path, filename required' }, { status: 400 });

  const { data, error } = await sb.from('documents').insert([{ org_id, truck_id, storage_path, filename, uploaded_by }]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  // We only delete the DB row here. If you want to remove file from storage as well, call storage API separately.
  const { error } = await sb.from('documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'ok' });
}
