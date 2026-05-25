import { NextRequest, NextResponse } from 'next/server';
import { getMasterAssignmentRouteContext, jsonError, normalizeDate } from '../_utils';
const SEL = 'id, classroom_id, title, description, due_date, section_id, created_by, created_at, updated_at, archived_at';
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) { try {
  const { assignmentId } = await params; const { adminClient } = await getMasterAssignmentRouteContext(req); const b = await req.json().catch(() => null); const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (b?.archived === true) updates.archived_at = new Date().toISOString(); else { const title = String(b?.title || '').trim(); if (!title) return NextResponse.json({ error: 'Assignment title is required.' }, { status: 400 }); updates.title = title; updates.description = String(b?.description || '').trim() || null; updates.due_date = normalizeDate(b?.due_date); }
  const { data, error } = await adminClient.from('assignments').update(updates).eq('id', assignmentId).select(SEL).single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Failed to update assignment.' }, { status: 500 });
  return NextResponse.json({ assignment: data });
} catch (e) { return jsonError(e); } }
