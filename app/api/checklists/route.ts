// app/api/checklists/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(URL, SR);

export async function POST(req: NextRequest) {
  // create a new checklist run
  const body = await req.json();
  const { org_id, truck_id, template_id, run_by, notes } = body;
  if (!org_id || !template_id || !run_by) return NextResponse.json({ error: 'org_id, template_id, run_by required' }, { status: 400 });

  const { data: checklist, error: e1 } = await sb.from('checklists').insert([{ org_id, truck_id, template_id, run_by, notes }]).select().single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // optionally insert initial responses array if provided
  if (body.responses && Array.isArray(body.responses)) {
    const rows = body.responses.map((r: any) => ({ checklist_id: checklist.id, template_item_id: r.template_item_id, value: r.value }));
    const { error: e2 } = await sb.from('responses').insert(rows);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json(checklist, { status: 201 });
}

export async function GET(req: NextRequest) {
  // list checklists for an org (filterable by truck or template)
  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  const { data, error } = await sb.from('checklists').select('*').eq('org_id', orgId).order('started_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
