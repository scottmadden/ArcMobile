// app/api/template-items/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(URL, SR);

export async function GET(req: NextRequest) {
  const templateId = req.nextUrl.searchParams.get('templateId');
  if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

  const { data, error } = await sb.from('template_items').select('*').eq('template_id', templateId).order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { template_id, label, type, required, sort_order } = body;
  if (!template_id || !label) return NextResponse.json({ error: 'template_id & label required' }, { status: 400 });

  const { data, error } = await sb.from('template_items').insert([{ template_id, label, type: type || 'boolean', required: required ?? true, sort_order: sort_order ?? 0 }]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, label, type, required, sort_order } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await sb.from('template_items').update({ label, type, required, sort_order }).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await sb.from('template_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'ok' });
}
