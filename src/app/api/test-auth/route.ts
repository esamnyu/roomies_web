// src/app/api/test-auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return NextResponse.json({ 
        error: 'Auth error', 
        details: error.message,
        cookies: Object.fromEntries(cookieStore.getAll().map(c => [c.name, c.value])) 
      }, { status: 401 });
    }
    
    if (!session) {
      return NextResponse.json({ 
        error: 'No session found',
        cookies: Object.fromEntries(cookieStore.getAll().map(c => [c.name, c.value]))
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      message: 'Authenticated', 
      userId: session.user.id,
      cookieCount: cookieStore.getAll().length
    });
  } catch (error) {
    return NextResponse.json({ error: 'Unknown error', details: String(error) }, { status: 500 });
  }
}