import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wtlgeaxxgewhuwjhlemv.supabase.co';

export async function POST(request) {
  const { passcode, id, action, title, description, category } = await request.json();

  if (!process.env.MODERATOR_PASSCODE || passcode !== process.env.MODERATOR_PASSCODE) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    );
  }
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  let update = {};
  if (action === 'approve') update = { status: 'approved' };
  else if (action === 'reject') update = { status: 'rejected' };
  else if (action === 'edit') update = { title, description, category };
  else return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await admin.from('suggestions').update(update).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
