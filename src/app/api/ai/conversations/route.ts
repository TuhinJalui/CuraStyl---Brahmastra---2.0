import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, sessionId, title, language, messages, preview, pinned } = body || {};

    const supabase = getServiceClient();
    if (!supabase) return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 501 });

    const row: any = {
      user_id: userId || null,
      session_id: sessionId || null,
      title: title || (Array.isArray(messages) && messages.find((m:any)=>m.role==='user')?.content?.slice(0,120)) || 'Chat',
      language: language || null,
      messages: messages || null,
      preview: preview || (Array.isArray(messages) ? messages[messages.length-1]?.content : null) || null,
      pinned: !!pinned,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('ai_conversations').insert([row]).select('*').limit(1);
    if (error) {
      console.error('Conversations insert failed:', error.message || error);
      return NextResponse.json({ ok: false, error: error.message || String(error) }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data: data?.[0] ?? null });
  } catch (err: any) {
    console.error('Conversations POST error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const sessionId = url.searchParams.get('sessionId');
    const limit = Number(url.searchParams.get('limit') || 50);

    const supabase = getServiceClient();
    if (!supabase) return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 501 });

    let q = supabase.from('ai_conversations').select('*').order('created_at', { ascending: false }).limit(limit);
    if (userId) q = q.eq('user_id', userId);
    else if (sessionId) q = q.eq('session_id', sessionId);

    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message || String(error) }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error('Conversations GET error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
